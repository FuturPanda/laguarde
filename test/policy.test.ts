import { describe, expect, test } from "bun:test";
import { PolicyStore } from "../src/db/store.js";
import { LaguardeService } from "../src/service.js";
import { globMatches } from "../src/policy.js";
import {
  buildAgentInstallContract,
  buildNpmAgentInstallContract,
} from "../src/install.js";
import {
  buildStaticHumanGuide,
  normalizePublicOrigin,
} from "../src/onboarding-export.js";

function setup(): { store: PolicyStore; service: LaguardeService } {
  const store = new PolicyStore(":memory:", { evidenceDir: null });
  return { store, service: new LaguardeService(store) };
}

describe("path policy matching", () => {
  test("supports repository globs", () => {
    expect(globMatches("src/**", "src/modules/user.ts")).toBe(true);
    expect(globMatches("**/.env", "apps/api/.env")).toBe(true);
    expect(globMatches("**/*.key", "certs/service.key")).toBe(true);
    expect(globMatches("src/**", "README.md")).toBe(false);
  });
});

describe("agent installation contract", () => {
  test("uses the serving origin and contains deterministic verification steps", () => {
    const contract = buildAgentInstallContract(
      "https://policies.example.test/",
    );

    expect(contract).toContain(
      "MCP_URL: https://policies.example.test/mcp",
    );
    expect(contract).toContain(
      "HEALTH_URL: https://policies.example.test/health",
    );
    expect(contract).toContain("get_policy_bundle");
    expect(contract).toContain("Prefer project/workspace scope");
    expect(contract).not.toContain("curl |");
  });

  test("builds an S3-ready human guide with a separate backend origin", () => {
    const source = [
      '<meta name="laguarde-backend-url" content="" />',
      '<meta name="laguarde-docs-url" content="" />',
      '<meta name="laguarde-install-url" content="" />',
      '<meta name="laguarde-package-name" content="" />',
      '<meta name="laguarde-package-version" content="" />',
      '<meta name="laguarde-package-url" content="" />',
      '<a class="brand" href="/guide">',
    ].join("");
    const html = buildStaticHumanGuide(
      source,
      normalizePublicOrigin("https://laguarde.example.test"),
    );

    expect(html).toContain(
      'name="laguarde-backend-url" content="https://laguarde.example.test"',
    );
    expect(html).toContain('class="brand" href="./"');
    expect(() =>
      normalizePublicOrigin("https://user@example.test/path"),
    ).toThrow();
  });

  test("builds a project-scoped npm installation contract", () => {
    const contract = buildNpmAgentInstallContract();

    expect(contract).toContain("NPM_PACKAGE: laguarde-mcp@0.2.1");
    expect(contract).toContain("COMMAND: npx");
    expect(contract).toContain('"args": ["-y", "laguarde-mcp@0.2.1"]');
    expect(contract).toContain("Require Node.js 24 or newer");
    expect(contract).toContain("Prefer project/workspace MCP configuration");
    expect(contract).toContain("It does not authorize elevated privileges");
    expect(contract).not.toContain("SHA-256");
  });

  test("pins an explicitly configured npm package version", () => {
    const contract = buildNpmAgentInstallContract({
      packageName: "@example/laguarde",
      packageVersion: "2.3.4",
    });

    expect(contract).toContain(
      "NPM_PACKAGE: @example/laguarde@2.3.4",
    );
    expect(contract).toContain('"@example/laguarde@2.3.4"');
  });
});

describe("policy evaluation", () => {
  test("allows an ordinary scoped source edit", () => {
    const { store, service } = setup();
    const result = service.evaluateAction({
      summary: "Add validation to the user service",
      action_type: "edit",
      targets: ["src/users/service.ts", "test/users/service.test.ts"],
    });

    expect(result.level).toBe("allowed");
    expect(result.matched_rules[0]?.guideline_id).toBe(
      "guard-project-source",
    );
    store.close();
  });

  test("forbids access to a real env file", () => {
    const { store, service } = setup();
    const result = service.evaluateAction({
      summary: "Put the production token in the environment",
      action_type: "edit",
      targets: ["apps/api/.env"],
    });

    expect(result.level).toBe("forbidden");
    expect(result.matched_rules[0]?.guideline_id).toBe(
      "guard-sensitive-files",
    );
    store.close();
  });

  test("an allowed example file does not exempt a real env file in the same action", () => {
    const { store, service } = setup();
    const result = service.evaluateAction({
      summary: "Update environment configuration",
      action_type: "edit",
      targets: [".env.example", ".env"],
    });

    expect(result.level).toBe("forbidden");
    store.close();
  });

  test("requires approval for a dependency change", () => {
    const { store, service } = setup();
    const result = service.evaluateAction({
      summary: "Add a new validation library",
      action_type: "dependency",
      dependencies: ["zod"],
      commands: ["bun add zod"],
    });

    expect(result.level).toBe("approval");
    expect(result.state).toBe("pending_approval");
    store.close();
  });

  test("fails safely when no policy matches", () => {
    const { store, service } = setup();
    const result = service.evaluateAction({
      summary: "Touch an undeclared generated path",
      action_type: "edit",
      targets: ["generated/output.bin"],
    });

    expect(result.level).toBe("limited");
    expect(result.matched_rules).toEqual([]);
    store.close();
  });
});

describe("audit and human review", () => {
  test("records and reviews approval-required decisions", () => {
    const { store, service } = setup();
    const decision = service.recordDecision({
      summary: "Delete the obsolete users table",
      action_type: "migration",
      targets: ["migrations/004-drop-users.sql"],
      requested_by: "agent-test",
    });

    expect(decision.state).toBe("pending_approval");
    expect(decision.related_guideline_revisions).toContain(
      "guard-migrations-deletions#v1",
    );

    const reviewed = store.reviewDecision(
      decision.id,
      "approved",
      "Alice",
      "Rollback verified",
    );
    expect(reviewed?.state).toBe("approved");
    expect(reviewed?.reviewed_by).toBe("Alice");
    store.close();
  });
});

describe("feedback convergence", () => {
  test("lets a human merge a pending proposal into a new revision immediately", () => {
    const { store, service } = setup();
    const initial = store.getGuideline("code-no-any")!;
    const proposal = service.proposePreference({
      scope_kind: "code_rule",
      scope_id: "code-no-any",
      title: "Allow a contextual exception",
      observation: "The frontend test harness needs a pragmatic exception.",
      suggested_edit:
        "Prefer precise types, but permit `any` in frontend-test when it is the clearest practical type.",
      proposed_by: "Agent",
    });

    expect(proposal.state).toBe("pending");
    expect(proposal.convergence_count).toBe(1);

    const accepted = store.reviewProposal(
      proposal.id,
      "accepted",
      "dashboard",
    );
    const revised = store.getGuideline("code-no-any")!;

    expect(accepted?.state).toBe("accepted");
    expect(revised.current_revision_no).toBe(initial.current_revision_no + 1);
    expect(revised.body).toContain("frontend-test");
    store.close();
  });

  test("promotes three observations and creates a ratified revision", () => {
    const { store, service } = setup();
    const initial = store.getGuideline("code-no-any")!;
    const proposal = service.proposePreference({
      scope_kind: "code_rule",
      scope_id: "code-no-any",
      title: "Clarify boundary exceptions",
      observation: "Use unknown at HTTP boundaries.",
      suggested_edit:
        "Use `unknown` at external boundaries and narrow it explicitly. Never use `any`.",
      proposed_by: "Alice",
    });

    service.proposePreference({
      existing_proposal_id: proposal.id,
      observation: "The SDK response should have been narrowed from unknown.",
      proposed_by: "Bob",
    });
    const promoted = service.proposePreference({
      existing_proposal_id: proposal.id,
      observation: "Please stop casting third-party payloads to any.",
      proposed_by: "Alice",
    });

    expect(promoted.state).toBe("promoted_candidate");
    expect(promoted.convergence_count).toBe(3);
    expect(promoted.proposed_by).toEqual(["Alice", "Bob", "Alice"]);

    const accepted = store.reviewProposal(
      proposal.id,
      "accepted",
      "Maintainer",
    );
    const revised = store.getGuideline("code-no-any")!;

    expect(accepted?.state).toBe("accepted");
    expect(revised.current_revision_no).toBe(initial.current_revision_no + 1);
    expect(revised.body).toContain("external boundaries");
    store.close();
  });

  test("merges a new-policy proposal into the policy registry", () => {
    const { store, service } = setup();
    const proposal = service.proposePreference({
      scope_kind: "general_rule",
      title: "Ask before changing CI providers",
      observation: "Keep the current CI provider unless the team agrees.",
      suggested_edit:
        "Changing CI providers requires explicit human approval.",
      proposed_by: "Alice",
    });

    const merged = store.reviewProposal(
      proposal.id,
      "accepted",
      "dashboard",
    );
    const created = store.getGuideline(merged!.scope_id!);

    expect(merged?.state).toBe("accepted");
    expect(created?.name).toBe("Ask before changing CI providers");
    expect(created?.body).toContain("explicit human approval");
    expect(created?.tags).toContain("feedback");
    expect(created?.fields.level).toBe("limited");
    expect(created?.status).toBe("active");
    expect(created?.current_revision_no).toBe(1);
    store.close();
  });
});
