#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Server } from "node:http";
import { createMcpServer } from "./mcp.js";
import { createRuntime } from "./runtime.js";
import { createApp } from "./server.js";

const runtime = createRuntime();
const mcp = createMcpServer(runtime.service);
const transport = new StdioServerTransport();
const dashboardPort = Number(
  process.env.LAGUARDE_DASHBOARD_PORT ?? process.env.PORT ?? 3000,
);
let dashboard: Server | undefined;

if (dashboardPort > 0) {
  dashboard = createApp(runtime.service, runtime.store).listen(
    dashboardPort,
    "127.0.0.1",
    () => {
      console.error(
        `[laguarde] Dashboard: http://127.0.0.1:${dashboardPort}`,
      );
      console.error(`[laguarde] Data: ${runtime.dbPath}`);
    },
  );
  dashboard.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[laguarde] Port ${dashboardPort} is already in use; MCP stdio remains available.`,
      );
      dashboard = undefined;
      return;
    }
    console.error(`[laguarde] Dashboard error: ${error.message}`);
  });
}

async function shutdown(): Promise<void> {
  dashboard?.close();
  await mcp.close();
  runtime.store.close();
}

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

await mcp.connect(transport);
