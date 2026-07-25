import { describe, expect, test } from "bun:test";
import { PolicyStore } from "../src/db/store.js";
import { LaguardeService } from "../src/service.js";
import { globMatches } from "../src/policy.js";
import {
  buildAgentInstallContract,
  buildLocalAgentInstallContract,
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
      '<meta name="laguarde-archive-url" content="" />',
      '<meta name="laguarde-checksum-url" content="" />',
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

  test("builds a URL-independent local installation contract", () => {
    const contract = buildLocalAgentInstallContract();

    expect(contract).toContain("ARCHIVE_URL: ./laguarde.zip");
    expect(contract).toContain(
      "CHECKSUM_URL: ./laguarde.zip.sha256",
    );
    expect(contract).toContain("docker compose up -d --build");
    expect(contract).toContain("bun install --frozen-lockfile");
    expect(contract).toContain("http://127.0.0.1:<PORT>/mcp");
    expect(contract).not.toContain("https://laguarde.example");
  });

  test("uses explicit public archive and checksum URLs", () => {
    const contract = buildLocalAgentInstallContract({
      archiveUrl: "https://example.test/zip",
      checksumUrl: "https://cdn.example.test/laguarde.zip.sha256",
    });

    expect(contract).toContain(
      "ARCHIVE_URL: https://example.test/zip",
    );
    expect(contract).toContain(
      "CHECKSUM_URL: https://cdn.example.test/laguarde.zip.sha256",
    );
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
});
