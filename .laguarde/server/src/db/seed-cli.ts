import { join } from "node:path";
import { PolicyStore } from "./store.js";

const path =
  process.env.LAGUARDE_DB_PATH ?? join(process.cwd(), "laguarde.db");
const store = new PolicyStore(path);
console.log(
  `Laguarde database ready at ${path} with ${store.guidelineCount()} guidelines.`,
);
store.close();
