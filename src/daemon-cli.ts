#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Health {
  status?: string;
  service?: string;
  version?: string;
  instance_id?: string | null;
}

const args = process.argv.slice(2);
const command = args[0] ?? "ensure";
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const port = Number(option("--port") ?? process.env.LAGUARDE_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Laguarde port must be an integer from 1 to 65535");
}
const origin = `http://127.0.0.1:${port}`;
const dataDir =
  process.env.LAGUARDE_DATA_DIR ?? join(homedir(), ".laguarde");
const pidPath = join(dataDir, "daemon.pid");

async function health(): Promise<Health | null> {
  try {
    const response = await fetch(`${origin}/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Health;
    return payload.status === "ok" && payload.service === "laguarde"
      ? payload
      : null;
  } catch {
    return null;
  }
}

async function ensureDaemon(): Promise<Health> {
  const running = await health();
  if (running) return running;

  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const logPath = join(dataDir, "daemon.log");
  const log = openSync(logPath, "a", 0o600);
  const serverPath = fileURLToPath(new URL("./server.js", import.meta.url));
  const instanceId = randomUUID();
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      PORT: String(port),
      LAGUARDE_HOST: "127.0.0.1",
      LAGUARDE_DATA_DIR: dataDir,
      LAGUARDE_INSTANCE_ID: instanceId,
    },
  });
  closeSync(log);
  if (!child.pid) {
    throw new Error("Laguarde daemon process did not start");
  }
  writeFileSync(
    pidPath,
    `${JSON.stringify({ pid: child.pid, instance_id: instanceId, port })}\n`,
    { mode: 0o600 },
  );
  child.unref();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 125));
    const started = await health();
    if (started) return started;
  }
  try {
    process.kill(child.pid, "SIGTERM");
  } catch {
    // The failed child may already have exited.
  }
  try {
    unlinkSync(pidPath);
  } catch {
    // Preserve the original startup error.
  }
  throw new Error(
    `Laguarde did not become healthy at ${origin}. Inspect ${logPath}`,
  );
}

function gitValue(cwd: string, gitArgs: string[]): string | undefined {
  try {
    return execFileSync("git", gitArgs, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function normalizedRepository(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const scp = value.match(/^git@([^:]+):(.+)$/);
  const scpHost = scp?.[1];
  const scpPath = scp?.[2];
  if (scpHost && scpPath) {
    return `https://${scpHost.toLowerCase()}/${scpPath.replace(/\.git$/, "")}`;
  }
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\.git$/, "").replace(/\/$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\.git$/, "");
  }
}

async function registerProject(): Promise<void> {
  await ensureDaemon();
  const requestedCwd = option("--cwd") ?? process.cwd();
  const cwd = realpathSync(requestedCwd);
  const root = gitValue(cwd, ["rev-parse", "--show-toplevel"]) ?? cwd;
  const repositoryUrl = normalizedRepository(
    gitValue(root, ["remote", "get-url", "origin"]),
  );
  let inferredName = basename(root);
  if (repositoryUrl) {
    try {
      inferredName = basename(new URL(repositoryUrl).pathname);
    } catch {
      inferredName = basename(repositoryUrl);
    }
  }
  const name = option("--name") ?? inferredName;
  const response = await fetch(`${origin}/api/projects/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      repository_url: repositoryUrl,
      root_path: root,
    }),
  });
  const payload = (await response.json()) as {
    error?: string;
    project?: { id: string; name: string };
    mcp_path?: string;
  };
  if (!response.ok || !payload.project || !payload.mcp_path) {
    throw new Error(payload.error ?? "Laguarde project registration failed");
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        daemon_url: origin,
        dashboard_url: `${origin}/`,
        project: payload.project,
        mcp_url: `${origin}${payload.mcp_path}`,
      },
      null,
      2,
    )}\n`,
  );
}

async function stopDaemon(): Promise<void> {
  let ownership: { pid: number; instance_id: string; port: number };
  try {
    ownership = JSON.parse(readFileSync(pidPath, "utf8")) as typeof ownership;
  } catch {
    throw new Error(
      `No Laguarde-owned daemon PID was found at ${pidPath}; no process was stopped`,
    );
  }
  if (
    !Number.isInteger(ownership.pid) ||
    ownership.pid < 2 ||
    !ownership.instance_id ||
    ownership.port !== port
  ) {
    throw new Error(`Invalid Laguarde daemon PID in ${pidPath}`);
  }
  const running = await health();
  if (!running) {
    unlinkSync(pidPath);
    process.stdout.write(
      `${JSON.stringify({ status: "already_stopped", pid: ownership.pid })}\n`,
    );
    return;
  }
  if (running.instance_id !== ownership.instance_id) {
    throw new Error(
      `The healthy service at ${origin} is not the Laguarde instance recorded in ${pidPath}; no process was stopped`,
    );
  }
  try {
    process.kill(ownership.pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  unlinkSync(pidPath);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!(await health())) {
      process.stdout.write(
        `${JSON.stringify({ status: "stopped", pid: ownership.pid })}\n`,
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Laguarde daemon ${ownership.pid} did not stop cleanly`);
}

if (command === "ensure" || command === "start") {
  const existing = await health();
  const status = existing ?? (await ensureDaemon());
  process.stdout.write(
    `${JSON.stringify({
      status: "ok",
      reused: Boolean(existing),
      daemon_url: origin,
      dashboard_url: `${origin}/`,
      version: status.version,
      data_dir: existing ? undefined : dataDir,
    })}\n`,
  );
} else if (command === "status") {
  const status = await health();
  if (!status) {
    process.stderr.write(`No Laguarde daemon is healthy at ${origin}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `${JSON.stringify({ status: "ok", daemon_url: origin, ...status })}\n`,
    );
  }
} else if (command === "register") {
  await registerProject();
} else if (command === "stop") {
  await stopDaemon();
} else {
  throw new Error(
    "Usage: laguarde-daemon ensure|status|register|stop [--port PORT] [--cwd PATH] [--name NAME]",
  );
}
