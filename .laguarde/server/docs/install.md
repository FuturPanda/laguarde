# Installation

## Local mode

Prerequisites:

- Bun 1.3 or newer;
- a writable directory for the SQLite database and decision evidence.

```bash
bun install
bun run start
```

Laguarde listens on port `3000` by default. The relevant URLs are:

- dashboard: `http://localhost:3000/`;
- MCP: `http://localhost:3000/mcp`;
- discovery: `http://localhost:3000/llms.txt`;
- health: `http://localhost:3000/health`.

Configuration:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `LAGUARDE_DB_PATH` | `./laguarde.db` | SQLite database |
| `LAGUARDE_EVIDENCE_DIR` | `./decisions` | Markdown decision evidence |
| `LAGUARDE_PUBLIC_URL` | request origin | Canonical public origin used in the agent installation contract |

## Team/self-hosted mode

The supplied container stores mutable state under `/data`.

```bash
docker compose up --build
```

Place an HTTPS reverse proxy in front of Laguarde and configure agent clients
with `https://your-host.example/mcp`.

The prototype has no application authentication or roles. Do not expose it to
the public internet. Run it on a trusted local or private team network until an
authentication layer is implemented.

Back up both `/data/laguarde.db` and `/data/decisions`. SQLite WAL files may
exist while the service is running, so use a SQLite-aware backup procedure for
a live instance.

## MCP clients

Any Streamable HTTP MCP client can use the `/mcp` endpoint. For example, a
client that supports URL-based MCP servers should be configured with:

```text
name: laguarde
transport: streamable-http
url: http://localhost:3000/mcp
```

Client-specific configuration changes over time; use the client's current MCP
documentation rather than copying an unverified vendor-specific file.
