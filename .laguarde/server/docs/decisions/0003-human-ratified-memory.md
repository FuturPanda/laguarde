# ADR 0003 — Require human-ratified feedback convergence

Status: accepted

## Decision

An agent may capture a preference proposal and attach matching observations.
Three observations promote the proposal, but only a human may accept it.
Acceptance creates a new immutable policy revision.

Repeated feedback from the same human counts but remains visible in the
contributor list.

## Why

Single comments are often local corrections rather than durable team policy.
Convergence reduces noise while retaining human authority over the shared
rules.

## Consequence

The v1 agent performs similarity judgment, so humans must detect accidental
over-merging or missed convergence in the dashboard.

