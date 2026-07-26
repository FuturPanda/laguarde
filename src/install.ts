export function buildAgentInstallContract(origin: string): string {
  const baseUrl = origin.replace(/\/+$/, "");
  return `LAGUARDE AGENT INSTALLATION CONTRACT
=====================================

FORMAT_VERSION: 2
PURPOSE: Register the current project and connect it to this Laguarde policy server.
BASE_URL: ${baseUrl}
HEALTH_URL: ${baseUrl}/health
PROJECT_RESOLUTION_URL: ${baseUrl}/api/projects/resolve
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

3. Resolve the current project.
   - Detect the Git root with: git rev-parse --show-toplevel
   - Read the canonical origin when present with: git remote get-url origin
   - POST JSON to ${baseUrl}/api/projects/resolve containing:
       name: repository directory or repository name
       repository_url: normalized origin URL when present
       root_path: local Git root for a local server; omit it for a remote team
                  server unless the human approved sharing that path
   - Require a project object and mcp_path in the response.
   - Reuse the returned project when it was already registered.

4. Inspect the current agent's native MCP configuration mechanism.
   - Prefer project/workspace scope.
   - Use user/global scope only if the human explicitly requested it.
   - Do not install an MCP bridge or package when native Streamable HTTP is
     available.

5. Add or update exactly one MCP server entry.
   - Name: laguarde
   - Transport: Streamable HTTP
   - URL: ${baseUrl} plus the returned mcp_path
   - Conceptual configuration:

     {
       "mcpServers": {
         "laguarde": {
           "type": "http",
          "url": "${baseUrl}/mcp/projects/RETURNED_PROJECT_ID"
         }
       }
     }

   Adapt the field names to the current client's documented native format.
   Preserve all unrelated MCP entries and configuration. If a different server
   already uses the name "laguarde", stop and ask before replacing it.

6. Reload MCP connections using the client's normal, non-destructive method.
   Do not terminate unrelated processes. If a full application restart is
   required and cannot be performed safely, tell the human what remains.

7. Verify the MCP connection.
   - Initialize the server and list tools.
   - Require these tools:
     get_policy_bundle
     evaluate_action
     record_decision
     list_preference_proposals
     propose_preference
   - Call get_policy_bundle. The project-bound endpoint selects the project;
     do not attempt to substitute another context_id.
   - Require at least one active policy and retain its revision IDs.

8. Report completion.
   State:
   - which configuration scope and file/mechanism changed;
   - the registered project ID and connected project-specific MCP URL;
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
  const packageVersion = options?.packageVersion ?? "0.3.0";
  const packageSpec = `${packageName}@${packageVersion}`;

  return `LAGUARDE LOCAL MCP INSTALLATION CONTRACT
========================================

FORMAT_VERSION: 3
PURPOSE: Reuse one local Laguarde daemon and connect the current project to it.
NPM_PACKAGE: ${packageSpec}
DAEMON_COMMAND: npx -y --package ${packageSpec} laguarde-daemon
DEFAULT_DAEMON_URL: http://127.0.0.1:3000
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

3. Reuse or start the single local daemon.
   - First GET http://127.0.0.1:3000/health.
   - If it reports {"status":"ok","service":"laguarde"}, reuse it. Do not
     start another Laguarde server.
   - Otherwise run exactly:
       npx -y --package ${packageSpec} laguarde-daemon ensure
   - Require the command to report status "ok" and daemon_url
     "http://127.0.0.1:3000".
   - The daemon stores its shared local database in the current OS user's
     Laguarde data directory. It must not create a separate database in each
     repository.

4. Register or resolve the current Git project.
   - From the repository root run exactly:
       npx -y --package ${packageSpec} laguarde-daemon register --cwd .
   - This detects the Git root and origin without reading repository contents.
   - Require JSON containing project.id, dashboard_url, and mcp_url.
   - Re-running this command for the same Git origin or root must return the
     same project instead of creating a duplicate.

5. Add exactly one Streamable HTTP MCP server entry.
   - Name: laguarde
   - URL: the project-specific mcp_url returned in step 4
   - Conceptual configuration:

     {
       "mcpServers": {
         "laguarde": {
           "type": "http",
           "url": "http://127.0.0.1:3000/mcp/projects/RETURNED_PROJECT_ID"
         }
       }
     }

   Adapt field names to the current client's documented native format. The MCP
   client connects to the daemon; it must not spawn another Laguarde process.

6. Reload MCP connections using the client's normal reversible mechanism.
   Do not terminate unrelated processes. If an application restart is required
   and cannot be performed safely, tell the human what remains.

7. Verify the MCP connection.
   - Initialize the server and list tools.
   - Require:
       get_policy_bundle
       evaluate_action
       record_decision
       list_preference_proposals
       propose_preference
   - Call get_policy_bundle. The endpoint is already bound to this project.
   - Require at least one active policy.

8. Report completion.
   State:
   - configuration scope and file/mechanism changed;
   - exact npm package version and reused/started daemon URL;
   - registered project ID and project-specific MCP URL;
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
- the client cannot connect to a native Streamable HTTP MCP server;
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
