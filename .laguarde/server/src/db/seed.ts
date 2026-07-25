import type { PolicyStore } from "./store.js";

export function seedStore(store: PolicyStore): void {
  if (store.guidelineCount() > 0) return;

  store.createContext({
    id: "default",
    name: "Default engineering context",
    description: "Shared policy for a TypeScript team using AI coding agents.",
    tags: ["typescript", "team-default"],
  });

  store.createGuideline({
    id: "guard-sensitive-files",
    kind: "general_rule",
    name: "Protect secrets and sensitive files",
    summary: "Agents must not access or change secrets, keys, or real env files.",
    body:
      "Never read, write, expose, log, or commit secrets. `.env.example` may be edited because it must contain placeholders only.",
    tags: ["security", "secrets"],
    fields: {
      level: "forbidden",
      match: {
        target_patterns: [
          ".env",
          "**/.env",
          "**/.env.*",
          "*.pem",
          "**/*.pem",
          "*.key",
          "**/*.key",
        ],
        target_exclusions: [".env.example", "**/.env.example"],
      },
    },
  });

  store.createGuideline({
    id: "guard-destructive-global",
    kind: "general_rule",
    name: "Block destructive global commands",
    summary: "Global destructive or privilege-escalating commands are forbidden.",
    body:
      "Never execute commands that can erase a broad system path, disable protections, or escalate privileges globally.",
    tags: ["security", "commands"],
    fields: {
      level: "forbidden",
      match: {
        command_patterns: [
          "rm -rf /",
          "sudo rm",
          "chmod -R 777 /",
          "git reset --hard",
        ],
      },
    },
  });

  store.createGuideline({
    id: "guard-dependencies",
    kind: "general_rule",
    name: "Approve dependency changes",
    summary: "Adding or removing dependencies requires human approval.",
    body:
      "Explain the need, license, maintenance status, and simpler alternatives before changing dependencies.",
    tags: ["dependencies", "supply-chain"],
    fields: {
      level: "approval",
      match: { action_types: ["dependency"] },
      evidence: ["dependency rationale", "license", "alternatives"],
    },
  });

  store.createGuideline({
    id: "guard-migrations-deletions",
    kind: "general_rule",
    name: "Approve migrations and deletions",
    summary: "Database migrations and material deletions require approval.",
    body:
      "Provide impact analysis, backup or rollback steps, and the exact scope before running a migration or deleting files.",
    tags: ["database", "destructive"],
    fields: {
      level: "approval",
      match: { action_types: ["migration", "delete"] },
      evidence: ["impact analysis", "rollback plan"],
    },
  });

  store.createGuideline({
    id: "guard-auth",
    kind: "general_rule",
    name: "Approve authentication and authorization changes",
    summary: "Security boundary changes require dedicated human review.",
    body:
      "Document affected roles, permission changes, abuse cases, and tests before changing authentication or authorization.",
    tags: ["security", "auth"],
    fields: {
      level: "approval",
      match: { action_types: ["auth"] },
      evidence: ["role impact", "abuse cases", "tests"],
    },
  });

  store.createGuideline({
    id: "guard-project-source",
    kind: "general_rule",
    name: "Allow scoped source and documentation edits",
    summary: "Ordinary edits inside source, test, and documentation folders are allowed.",
    body:
      "Agents may edit declared files under src, test, tests, and docs when the change remains within the request scope and is verified.",
    tags: ["scope", "development"],
    fields: {
      level: "allowed",
      match: {
        action_types: ["edit", "read", "review"],
        target_patterns: ["src/**", "test/**", "tests/**", "docs/**", "README.md"],
      },
    },
  });

  store.createGuideline({
    id: "code-no-any",
    kind: "code_rule",
    name: "Avoid TypeScript any",
    summary: "Use precise types or unknown rather than any.",
    body:
      "Do not introduce `any`. Prefer a domain type or `unknown` followed by explicit narrowing. A documented boundary exception requires review.",
    tags: ["typescript", "type-safety"],
    context_tags: ["typescript"],
    fields: { language: "typescript" },
  });

  store.createGuideline({
    id: "code-layer-separation",
    kind: "code_rule",
    name: "Keep transport and persistence out of domain logic",
    summary: "Controllers delegate to services; domain code avoids infrastructure dependencies.",
    body:
      "Controllers validate transport input and delegate. Business behavior belongs in services/domain modules. Persistence is isolated behind repositories.",
    tags: ["architecture", "separation"],
  });

  store.createGuideline({
    id: "init-nest-api",
    kind: "project_init",
    name: "NestJS API bootstrap",
    summary: "Bootstrap a strict NestJS API with health endpoint and tests.",
    body:
      "Initialize TypeScript first. Ask for Bun or pnpm. Add NestJS module/controller/service separation, GET /health, strict compiler flags, and a controller unit test. Dependency installation requires a separate approved action.",
    tags: ["nestjs", "typescript", "api"],
    fields: {
      recipe_mode: "strict",
      package_managers: ["bun", "pnpm"],
      requires: ["package.json", "tsconfig.json"],
    },
  });

  store.createGuideline({
    id: "pr-core-checklist",
    kind: "pr_review_guideline",
    name: "Core pull request review",
    summary: "Review scope, behavior, tests, security, and rollback impact.",
    body:
      "Confirm the change matches its stated scope; tests cover behavior and edge cases; no secret is exposed; permissions do not expand silently; destructive changes have rollback instructions.",
    tags: ["review", "quality"],
    fields: {
      checklist: [
        "scope matches request",
        "tests and edge cases",
        "no secrets",
        "permission impact",
        "rollback for destructive changes",
      ],
    },
  });
}
