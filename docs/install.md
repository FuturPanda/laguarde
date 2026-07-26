# Installation

## Local mode

Prerequisites:

- Node.js 24 or newer with npm/npx;
- a writable directory for the SQLite database and decision evidence.

Ensure the one local daemon is running, then register the current repository:

```bash
npx -y --package laguarde-mcp@0.3.1 laguarde-daemon ensure
npx -y --package laguarde-mcp@0.3.1 laguarde-daemon register --cwd .
```

The registration command prints a stable project ID and MCP URL. Configure the
current project's MCP client with that URL:

```json
{
  "mcpServers": {
    "laguarde": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp/projects/RETURNED_PROJECT_ID"
    }
  }
}
```

`laguarde-daemon ensure` checks the health endpoint before starting anything,
so repeated installations reuse the same process and database. The relevant
local settings are:

- dashboard: `http://127.0.0.1:3000/`;
- persistent data: `~/.laguarde/` by default for the packaged daemon.

Configuration:

| Variable | Default | Purpose |
|---|---|---|
| `LAGUARDE_PORT` | `3000` | Local daemon port used by `laguarde-daemon` |
| `LAGUARDE_HOST` | `127.0.0.1` | HTTP bind address; containers set `0.0.0.0` |
| `LAGUARDE_DATA_DIR` | `~/.laguarde` | Packaged daemon data directory |
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

Place an HTTPS reverse proxy in front of Laguarde, register each project through
`POST /api/projects/resolve`, and configure agents with the returned
`https://your-host.example/mcp/projects/:projectId` endpoint.

The prototype has no application authentication or roles. Do not expose it to
the public internet. Run it on a trusted local or private team network until an
authentication layer is implemented.

Back up both `/data/laguarde.db` and `/data/decisions`. SQLite WAL files may
exist while the service is running, so use a SQLite-aware backup procedure for
a live instance.

## MCP clients

Any Streamable HTTP MCP client can use a project-bound endpoint. For example:

```text
name: laguarde
transport: streamable-http
url: http://localhost:3000/mcp/projects/your-project-id
```

Client-specific configuration changes over time; use the client's current MCP
documentation rather than copying an unverified vendor-specific file.
