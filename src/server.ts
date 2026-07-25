import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRouter } from "./api.js";
import type { PolicyStore } from "./db/store.js";
import { createMcpServer } from "./mcp.js";
import type { LaguardeService } from "./service.js";
import { buildAgentInstallContract } from "./install.js";
import { createRuntime } from "./runtime.js";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const projectDir = join(sourceDir, "..");

export function createApp(
  service: LaguardeService,
  store: PolicyStore,
): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", createApiRouter(service));
  app.use(express.static(join(projectDir, "public")));

  app.get("/guide", (_req, res) => {
    res.sendFile(join(projectDir, "public", "guide.html"));
  });

  app.get(["/install", "/install.txt"], (req, res) => {
    const host = req.get("host") ?? "localhost:3000";
    const origin =
      process.env.LAGUARDE_PUBLIC_URL?.replace(/\/+$/, "") ??
      `${req.protocol}://${host}`;
    res
      .set("Cache-Control", "no-store")
      .type("text/plain")
      .send(buildAgentInstallContract(origin));
  });

  app.get("/llms.txt", (_req, res) => {
    res.type("text/plain").sendFile(join(projectDir, "llms.txt"));
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "laguarde",
      version: "0.1.0",
      guidelines: store.guidelineCount(),
    });
  });

  app.post("/mcp", async (req, res) => {
    const mcp = createMcpServer(service);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    },
  );
  return app;
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
const isMain =
  import.meta.main === true || fileURLToPath(import.meta.url) === entryPath;

if (isMain) {
  const { service, store } = createRuntime();
  const port = Number(process.env.PORT ?? 3000);
  createApp(service, store).listen(port, () => {
    console.error(`Laguarde dashboard: http://localhost:${port}`);
    console.error(`Laguarde MCP:       http://localhost:${port}/mcp`);
  });
}
