# Control-boundary example

These two requests are intentionally close: both edit configuration for the
same API.

## Controlled case

[`allowed.json`](allowed.json) changes the placeholder-only `.env.example`
documentation. No explicit allow rule currently covers that root file, so the
fail-safe result is `limited`: the agent must narrow the request or submit it
as a documentation change covered by policy.

[`source-edit-allowed.json`](source-edit-allowed.json) is the positive
`allowed` case: it changes a declared source file and its test.

## Risky case

[`forbidden.json`](forbidden.json) targets the real `.env`. It matches
`guard-sensitive-files#v1` and is `forbidden`. The next action is to stop and
use placeholders in `.env.example` instead.

The distinction is made from structured targets, not from optimistic natural
language alone.

