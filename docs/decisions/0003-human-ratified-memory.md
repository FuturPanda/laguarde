# ADR 0003 — Require human-ratified feedback convergence

Status: accepted

## Decision

An agent may capture a preference proposal and attach matching observations.
A human may accept it after any observation; three observations promote it as
a stronger review candidate. Acceptance creates a new immutable policy revision
or a new active policy when the proposal has no existing target.

Repeated feedback from the same human counts but remains visible in the
contributor list.

## Why

Single comments are often local corrections rather than durable team policy,
so convergence remains visible as a confidence signal. It does not override a
human's authority to ratify an immediately useful proposal.

## Consequence

The v1 agent performs similarity judgment, so humans must detect accidental
over-merging or missed convergence in the dashboard.
