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

export function buildNpmAgentInstallContract(options?: {
  packageName?: string;
  packageVersion?: string;
}): string {
  const packageName = options?.packageName ?? "laguarde-mcp";
  const packageVersion = options?.packageVersion ?? "0.2.0";
  const packageSpec = `${packageName}@${packageVersion}`;

  return `LAGUARDE LOCAL MCP INSTALLATION CONTRACT
========================================

FORMAT_VERSION: 2
PURPOSE: Configure Laguarde as a project-local MCP server.
NPM_PACKAGE: ${packageSpec}
COMMAND: npx
ARGS: -y ${packageSpec}
DEFAULT_DATA_DIR: ./.laguarde
DEFAULT_DASHBOARD_URL: http://127.0.0.1:3000/

AUTHORIZATION
-------------
Proceed only when the human explicitly supplied this installation document and
asked you to install Laguarde for the current project. That request authorizes
one minimal, reversible, project/workspace-scoped MCP configuration change.

It does not authorize elevated privileges, a global npm install, disabling
security controls, reading secrets, replacing unrelated MCP configuration, or
modifying other projects.

INSTALLATION ALGORITHM
----------------------
1. Inspect the current project and MCP client.
   - Work inside the current project only.
   - Prefer project/workspace MCP configuration.
   - Use user/global scope only when the human explicitly requested it.
   - Preserve every unrelated MCP entry.
   - If a different server already uses the name "laguarde", stop and ask
     before replacing it.

2. Verify prerequisites.
   - Require Node.js 24 or newer and npm/npx.
   - Do not install Node.js, npm, or system packages automatically.
   - Optionally inspect the declared package with:
       npm view ${packageSpec} name version dist.integrity
   - Require the returned name and version to match NPM_PACKAGE.

3. Add exactly one stdio MCP server entry.
   - Name: laguarde
   - Command: npx
   - Arguments: ["-y", "${packageSpec}"]
   - Conceptual configuration:

     {
       "mcpServers": {
         "laguarde": {
           "command": "npx",
           "args": ["-y", "${packageSpec}"]
         }
       }
     }

   Adapt field names to the current client's documented native format. Do not
   run a second background copy of Laguarde: the MCP client owns the stdio
   subprocess. Laguarde persists its SQLite database and decision evidence in
   ./.laguarde by default.

4. Handle the optional dashboard safely.
   - The stdio process attempts to expose the human dashboard only on
     http://127.0.0.1:3000/.
   - If another service already owns port 3000, MCP remains available.
   - To choose another port, add LAGUARDE_DASHBOARD_PORT to this server entry's
     environment without changing unrelated environment values.
   - Use LAGUARDE_DASHBOARD_PORT=0 when no dashboard is wanted.

5. Reload MCP connections using the client's normal reversible mechanism.
   Do not terminate unrelated processes. If an application restart is required
   and cannot be performed safely, tell the human what remains.

6. Verify the MCP connection.
   - Initialize the server and list tools.
   - Require:
       get_policy_bundle
       evaluate_action
       record_decision
       list_preference_proposals
       propose_preference
   - Call get_policy_bundle with {"context_id":"default"}.
   - Require at least one active policy.

7. Report completion.
   State:
   - configuration scope and file/mechanism changed;
   - exact npm package version;
   - whether tool discovery and get_policy_bundle succeeded;
   - data directory and dashboard URL, when enabled;
   - any remaining manual reload step.

FAIL-SAFE CONDITIONS
--------------------
Stop without broadening the installation when:
- the npm package identity or version is unexpected;
- Node.js 24 or npm/npx is unavailable;
- installation requires elevated privileges or global changes;
- configuration would overwrite an unrelated entry;
- the client cannot launch a standard stdio MCP server;
- verification fails.

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
