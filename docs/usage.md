# Usage

## 1. Load the applicable policy

Call `get_policy_bundle` when starting work:

```json
{
  "context_id": "default"
}
```

The result contains all active policies plus immutable `current_revision_id`
values. Decisions later retain these identifiers even if a policy changes.

## 2. Preview an action

Submit what the agent actually intends to do:

```json
{
  "context_id": "default",
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

Open the **Decision gate** tab. Pending approval records can be approved or
rejected. The review updates the existing evidence record.

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

After three observations the proposal becomes `promoted_candidate`. A human
can refine and accept it in the **Feedback queue**. Acceptance creates a new
immutable guideline revision.

## Dashboard policy editing

The **Policies** tab supports adding, editing, searching, and archiving. Editing
requires a rationale and creates a revision; archival is a soft delete, so
historical decision references remain meaningful.

