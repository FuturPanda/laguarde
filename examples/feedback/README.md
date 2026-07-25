# Feedback convergence example

The fixture [`observations.json`](observations.json) represents three developer
corrections about the existing `code-no-any` policy.

1. The first observation creates a `pending` proposal.
2. The next two calls reference the same proposal ID.
3. The third observation changes its state to `promoted_candidate`.
4. A maintainer accepts it in the dashboard.
5. Laguarde creates `code-no-any#v2` and keeps `code-no-any#v1` immutable.

The maintainer could also accept the proposal after its first observation; the
three-observation example demonstrates promotion, not an acceptance gate.

Alice appears twice. Both observations count, but the dashboard displays
`["Alice", "Bob", "Alice"]` so the reviewer can judge the actual convergence.

At no point may the agent directly update the accepted policy.
