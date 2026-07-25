# ADR 0001 — Use a policy control plane with MCP

Status: accepted

## Decision

Laguarde uses a persistent server with a standard MCP agent interface and a
REST-backed human dashboard.

## Why

Agents need dynamic, context-specific policy rather than a copied prompt that
silently becomes stale. Humans need one source of truth, revision history, and
a review queue. MCP gives multiple agent environments a shared interface
without tying the core data model to one model vendor.

## Consequence

The server can make and record policy decisions, but MCP alone cannot intercept
every external tool. Hard enforcement remains an adapter responsibility.

