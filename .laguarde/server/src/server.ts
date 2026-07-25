import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRouter } from "./api.js";
import { PolicyStore } from "./db/store.js";
import { createMcpServer } from "./mcp.js";
import { LaguardeService } from "./service.js";
import { buildAgentInstallContract } from "./install.js";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const projectDir = join(sourceDir, "..");
const dbPath =
  process.env.LAGUARDE_DB_PATH ?? join(process.cwd(), "laguarde.db");
const evidenceDir =
  process.env.LAGUARDE_EVIDENCE_DIR ?? join(process.cwd(), "decisions");
const store = new PolicyStore(dbPath, { evidenceDir });
const service = new LaguardeService(store);

export function createApp(): express.Express {
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

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`Laguarde dashboard: http://localhost:${port}`);
    console.log(`Laguarde MCP:       http://localhost:${port}/mcp`);
  });
}
