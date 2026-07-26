# Current limits

- MCP is advisory unless an execution environment makes Laguarde evaluation a
  mandatory precondition.
- No authentication, organization isolation, or roles are implemented.
- All dashboard users can modify policy and ratify decisions or proposals.
- Local Git projects are registered and inherit global policy, but authenticated
  organization/team hierarchy and explicit override precedence are not implemented.
- Evaluation uses declared action metadata and simple path/text matching; it
  does not inspect an actual diff or command AST.
- An agent chooses whether feedback is similar enough to attach to an existing
  proposal. This can under-merge or over-merge observations.
- Three observations promote a proposal as a stronger candidate, but a human
  may merge a proposal at any time and the signal has no time decay.
- Approval is not bound to a cryptographic action digest and does not expire.
- Markdown evidence may contain untrusted request text and should be treated as
  data, not executable instructions.
- Schema upgrades are additive; rollback migrations and multi-host SQLite
  coordination are not included.
