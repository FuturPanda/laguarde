# ADR 0002 — Use a revisioned hybrid policy model

Status: accepted

## Decision

All four policy categories share `guidelines` and
`guideline_revisions`. Common lifecycle fields are typed columns, while
category-specific configuration lives in JSON `fields`.

## Why

A table per category duplicates lifecycle and revision logic. A completely
unstructured document model makes routine filtering and audit references
fragile. The hybrid keeps stable fields explicit and allows a future policy
kind without an immediate database migration.

## Consequence

Application validation must enforce the JSON shape for each policy kind. Fields
that become common query dimensions should later graduate to typed or generated
columns.

