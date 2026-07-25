# Installation

## Local mode

Prerequisites:

- Node.js 24 or newer with npm/npx;
- a writable directory for the SQLite database and decision evidence.

Configure the current MCP client to launch:

```json
{
  "mcpServers": {
    "laguarde": {
      "command": "npx",
      "args": ["-y", "laguarde-mcp@0.1.0"]
    }
  }
}
```

The client owns the stdio subprocess. Laguarde also attempts to expose its
dashboard on port `3000`; a port collision does not stop the MCP connection.
The relevant local settings are:

- dashboard: `http://127.0.0.1:3000/`;
- persistent data: `./.laguarde/`.

Configuration:

| Variable | Default | Purpose |
|---|---|---|
| `LAGUARDE_DASHBOARD_PORT` | `3000` | Local dashboard port; set to `0` to disable |
| `LAGUARDE_DATA_DIR` | `./.laguarde` | Persistent data directory |
| `LAGUARDE_DB_PATH` | `<data-dir>/laguarde.db` | SQLite database override |
| `LAGUARDE_EVIDENCE_DIR` | `<data-dir>/decisions` | Markdown evidence override |

For source development:

```bash
bun install
bun run build
bun run start
```
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
