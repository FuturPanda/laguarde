# Usage

## 1. Load the applicable policy

Connect through the project's `/mcp/projects/:projectId` URL, then call
`get_policy_bundle` when starting work:

```json
{}
```

The endpoint binds every tool call to the registered project, regardless of an
agent-supplied context. The result contains inherited global policies,
project-specific policies, and immutable `current_revision_id` values.
Decisions retain these identifiers even if a policy later changes.

## 2. Preview an action

Submit what the agent actually intends to do:

```json
{
  "summary": "Add input validation to the user service",
  "action_type": "edit",
  "targets": [
    "src/users/service.ts",
    "test/users/service.test.ts"
  ],
  "requested_by": "agent-session-42"
}
```

`evaluate_action` returns:

- `allowed`: proceed within the declared scope and verify the result;
- `limited`: split, narrow, or clarify the action and evaluate again;
- `approval`: record the action and wait for a human review;
- `forbidden`: stop and propose a safe alternative.

Commands and dependencies must be listed explicitly. Never send secret values
to Laguarde.

## 3. Record evidence

Call `record_decision` with the same exact action. Laguarde evaluates it again
and writes both:

- a row in the `decisions` table;
- a Markdown record under the configured evidence directory.

`record_decision` cannot override the policy result and cannot self-approve an
approval-required action.

## 4. Human review

Approval-required decisions remain available through the decisions API for a
human reviewer. The dashboard now focuses on policy authoring instead of
mixing agent decision input with human policy changes.

In the prototype, approval is informational: an execution adapter must check
the decision state before the real command or file operation to make it a hard
gate.

## 5. Capture reusable feedback

First call `list_preference_proposals`. If the feedback matches an existing
proposal, call `propose_preference` with its `existing_proposal_id`:

```json
{
  "existing_proposal_id": "prop-example",
  "observation": "Use unknown and narrow third-party payloads explicitly.",
  "proposed_by": "Alice"
}
```

Otherwise create a proposal:

```json
{
  "scope_kind": "code_rule",
  "scope_id": "code-no-any",
  "title": "Clarify third-party payload typing",
  "observation": "Do not cast SDK responses to any.",
  "suggested_edit": "Use unknown at external boundaries and narrow it explicitly. Never use any.",
  "proposed_by": "Alice"
}
```

Every proposal can be merged with one click in the **Feedback queue**, including
a proposal with a single observation. After three observations it becomes a
`promoted_candidate`, which raises its review priority without blocking earlier
human acceptance. A targeted proposal creates a new immutable revision; an
untargeted proposal creates a new active policy.

## Dashboard policy editing

The **Policies** tab supports adding, editing, searching, and archiving directly.
Every edit creates a new immutable revision. It never
records an agent decision. Editing requires a rationale and creates a revision;
archival is a soft delete, so historical decision references remain meaningful.
