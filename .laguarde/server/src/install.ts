export function buildAgentInstallContract(origin: string): string {
  const baseUrl = origin.replace(/\/+$/, "");
  return `LAGUARDE AGENT INSTALLATION CONTRACT
=====================================

FORMAT_VERSION: 1
PURPOSE: Connect the current agent environment to this Laguarde policy server.
BASE_URL: ${baseUrl}
MCP_URL: ${baseUrl}/mcp
HEALTH_URL: ${baseUrl}/health
POLICY_DISCOVERY_URL: ${baseUrl}/llms.txt
HUMAN_GUIDE_URL: ${baseUrl}/guide

AUTHORIZATION
-------------
Proceed only when the human explicitly asked you to install or connect the
Laguarde URL they supplied. That request authorizes one minimal, reversible MCP
configuration change for the current project or workspace. It does not
authorize installing unrelated software, changing security controls, reading
secrets, or modifying other projects.

INSTALLATION ALGORITHM
----------------------
1. Verify the server.
   - GET ${baseUrl}/health
   - Require an HTTP 200 JSON response with:
     "status": "ok"
     "service": "laguarde"
   - If verification fails, stop and report the error. Do not work around TLS,
     proxy, or certificate protections.

2. Read the operating contract.
   - GET ${baseUrl}/llms.txt
   - Treat it as policy instructions from the server selected by the human.

3. Inspect the current agent's native MCP configuration mechanism.
   - Prefer project/workspace scope.
   - Use user/global scope only if the human explicitly requested it.
   - Do not install an MCP bridge or package when native Streamable HTTP is
     available.

4. Add or update exactly one MCP server entry.
   - Name: laguarde
   - Transport: Streamable HTTP
   - URL: ${baseUrl}/mcp
   - Conceptual configuration:

     {
       "mcpServers": {
         "laguarde": {
           "type": "http",
           "url": "${baseUrl}/mcp"
         }
       }
     }

   Adapt the field names to the current client's documented native format.
   Preserve all unrelated MCP entries and configuration. If a different server
   already uses the name "laguarde", stop and ask before replacing it.

5. Reload MCP connections using the client's normal, non-destructive method.
   Do not terminate unrelated processes. If a full application restart is
   required and cannot be performed safely, tell the human what remains.

6. Verify the MCP connection.
   - Initialize the server and list tools.
   - Require these tools:
     get_policy_bundle
     evaluate_action
     record_decision
     list_preference_proposals
     propose_preference
   - Call get_policy_bundle with {"context_id":"default"}.
   - Require at least one active policy and retain its revision IDs.

7. Report completion.
   State:
   - which configuration scope and file/mechanism changed;
   - the connected MCP URL;
   - whether tool discovery and get_policy_bundle succeeded;
   - any remaining manual reload step.

FAIL-SAFE CONDITIONS
--------------------
Stop without making broader changes when:
- the server identity or health response is unexpected;
- the client has no native Streamable HTTP MCP support;
- configuration would overwrite an unrelated entry;
- credentials, elevated privileges, global package installation, or disabled
  security checks would be required;
- the requested scope is ambiguous and only a global change is possible.

AFTER INSTALLATION
------------------
- Call get_policy_bundle at the beginning of relevant work.
- Call evaluate_action before a material action.
- Call record_decision to persist the exact evaluated request.
- Proceed only for "allowed".
- Narrow and re-evaluate "limited".
- Wait for recorded human approval for "approval".
- Never execute "forbidden".
- Capture reusable developer feedback with propose_preference.
- Never ratify your own policy proposal.

END OF CONTRACT
`;
}

export function buildLocalAgentInstallContract(options?: {
  archiveName?: string;
  checksumName?: string;
  archiveUrl?: string;
  checksumUrl?: string;
}): string {
  const archiveName = options?.archiveName ?? "laguarde.zip";
  const checksumName =
    options?.checksumName ?? `${archiveName}.sha256`;
  const archiveUrl = options?.archiveUrl ?? `./${archiveName}`;
  const checksumUrl = options?.checksumUrl ?? `./${checksumName}`;

  return `LAGUARDE LOCAL INSTALLATION CONTRACT
====================================

FORMAT_VERSION: 1
PURPOSE: Install and run Laguarde locally for the current project.
ARCHIVE_URL: ${archiveUrl}
CHECKSUM_URL: ${checksumUrl}
DEFAULT_DASHBOARD_URL: http://127.0.0.1:3000/
DEFAULT_MCP_URL: http://127.0.0.1:3000/mcp

URL RESOLUTION
--------------
When ARCHIVE_URL or CHECKSUM_URL is relative, resolve it against the URL of this
installation document. Absolute URLs must be used exactly as written.
For example, if this document was fetched from:

  https://docs.example.com/install

then download:

  https://docs.example.com/${archiveName}
  https://docs.example.com/${checksumName}

AUTHORIZATION
-------------
Proceed only when the human explicitly supplied this installation URL and asked
you to install Laguarde for the current project. That request authorizes:
- downloading the two declared artifacts;
- creating a project-local .laguarde/server directory;
- installing the archive's locked application dependencies when Bun is used;
- starting one local Laguarde service;
- adding one project/workspace-scoped MCP configuration entry.

It does not authorize elevated privileges, global package installation,
disabling security controls, reading secrets, replacing an existing Laguarde
installation, or modifying unrelated projects.

INSTALLATION ALGORITHM
----------------------
1. Inspect before changing anything.
   - Work inside the current project only.
   - If .laguarde/server already exists, inspect it and its health endpoint.
   - Do not overwrite an existing installation. Reuse it when healthy or ask
     the human before replacing or upgrading it.

2. Download and verify.
   - Download ARCHIVE_URL and CHECKSUM_URL to a temporary directory.
   - Read the expected SHA-256 value from CHECKSUM_URL.
   - Compute SHA-256 for the downloaded archive and require an exact match.
   - If verification fails, delete the temporary download and stop.
   - Never execute a downloaded script before verification.

3. Extract safely.
   - Inspect archive entries first.
   - Reject absolute paths, parent traversal, or files outside the archive root.
   - Create .laguarde/server and extract ARCHIVE there.
   - Keep persistent data under .laguarde/server/data or the Docker volume.

4. Select one available local runtime.
   Preferred mode — Docker:
   - Require Docker with Compose support.
   - From .laguarde/server run:
       docker compose up -d --build

   Fallback mode — Bun:
   - Require Bun 1.3 or newer.
   - From .laguarde/server run:
       bun install --frozen-lockfile
   - Start the service with its normal managed background-process mechanism:
       LAGUARDE_DB_PATH=./data/laguarde.db
       LAGUARDE_EVIDENCE_DIR=./data/decisions
       PORT=3000
       bun run start

   Do not install Docker, Bun, or system packages automatically. If neither
   runtime already exists, stop and tell the human what prerequisite is needed.

5. Handle the port safely.
   - Check http://127.0.0.1:3000/health.
   - If it already returns service "laguarde", reuse that instance.
   - If port 3000 belongs to another service, choose an available project-local
     port and set LAGUARDE_PORT for Docker or PORT for Bun.
   - Record the selected port for MCP configuration.

6. Verify Laguarde.
   - GET http://127.0.0.1:<PORT>/health
   - Require HTTP 200 JSON with:
       "status": "ok"
       "service": "laguarde"
   - Read http://127.0.0.1:<PORT>/llms.txt.

7. Configure the current MCP client.
   - Prefer project/workspace scope.
   - Add or update exactly one server named "laguarde".
   - Transport: Streamable HTTP.
   - URL: http://127.0.0.1:<PORT>/mcp
   - Preserve every unrelated configuration entry.
   - Stop and ask before replacing a conflicting server named "laguarde".

8. Verify the MCP connection.
   - Initialize the MCP server and list its tools.
   - Require:
       get_policy_bundle
       evaluate_action
       record_decision
       list_preference_proposals
       propose_preference
   - Call get_policy_bundle with {"context_id":"default"}.
   - Require at least one active policy.

9. Report completion.
   State:
   - installation directory;
   - Docker or Bun mode;
   - selected local port and MCP URL;
   - changed MCP configuration scope/file or mechanism;
   - health, tool discovery, and policy-bundle results;
   - how the local service can be stopped and restarted.

FAIL-SAFE CONDITIONS
--------------------
Stop without broadening the installation when:
- checksum verification fails;
- the archive contains unsafe paths;
- the target installation already exists but is unhealthy or modified;
- neither Docker Compose nor Bun is available;
- installation requires elevated privileges or global system changes;
- the MCP configuration would overwrite an unrelated entry;
- the local health response identifies a different service.

AFTER INSTALLATION
------------------
- Call get_policy_bundle at the beginning of relevant work.
- Call evaluate_action before a material action.
- Call record_decision to persist the exact evaluated request.
- Proceed only for "allowed".
- Narrow and re-evaluate "limited".
- Wait for recorded human approval for "approval".
- Never execute "forbidden".
- Capture reusable developer feedback with propose_preference.
- Never ratify your own policy proposal.

END OF CONTRACT
`;
}
