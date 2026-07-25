# NestJS API bootstrap example

This example uses the seeded `init-nest-api` policy.

## Context

The agent calls `get_policy_bundle` with `default` and finds:

- `init-nest-api#v1`;
- TypeScript and architecture code rules;
- source-edit, dependency, secrets, migration, and authentication guardrails;
- the core PR review checklist.

## Safe first action

The agent prepares the module, controller, service, health endpoint, and test as
a scoped source edit:

```json
{
  "context_id": "default",
  "summary": "Create the NestJS module, health controller, service, and unit test",
  "action_type": "edit",
  "targets": [
    "src/main.ts",
    "src/app.module.ts",
    "src/app.controller.ts",
    "src/app.service.ts",
    "test/app.controller.test.ts"
  ],
  "requested_by": "bootstrap-demo"
}
```

Expected decision: `allowed` by `guard-project-source#v1`.

## Separately gated dependency action

The recipe requires NestJS dependencies. The agent must not hide that change
inside the source-edit decision:

```json
{
  "context_id": "default",
  "summary": "Install the NestJS runtime dependencies required by init-nest-api",
  "action_type": "dependency",
  "dependencies": [
    "@nestjs/common",
    "@nestjs/core",
    "@nestjs/platform-express",
    "reflect-metadata",
    "rxjs"
  ],
  "commands": [
    "bun add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs"
  ],
  "requested_by": "bootstrap-demo"
}
```

Expected decision: `approval` by `guard-dependencies#v1`. A human reviews the
dependency rationale before installation. This split demonstrates the boundary:
the project recipe describes the desired result but does not bypass team
guardrails.

