import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PolicyStore } from "./db/store.js";
import { LaguardeService } from "./service.js";

export interface LaguardeRuntime {
  store: PolicyStore;
  service: LaguardeService;
  dbPath: string;
  evidenceDir: string;
}

export function createRuntime(): LaguardeRuntime {
  const dataDir =
    process.env.LAGUARDE_DATA_DIR ?? join(process.cwd(), ".laguarde");
  const dbPath =
    process.env.LAGUARDE_DB_PATH ?? join(dataDir, "laguarde.db");
  const evidenceDir =
    process.env.LAGUARDE_EVIDENCE_DIR ?? join(dataDir, "decisions");

  mkdirSync(dirname(dbPath), { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });

  const store = new PolicyStore(dbPath, { evidenceDir });
  return {
    store,
    service: new LaguardeService(store),
    dbPath,
    evidenceDir,
  };
}
