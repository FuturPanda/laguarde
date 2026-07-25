import {
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { buildNpmAgentInstallContract } from "../src/install.js";
import { buildStaticHumanGuide } from "../src/onboarding-export.js";

function valueAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const outputDir = resolve(
  process.cwd(),
  valueAfter("--out") ?? "static-onboarding",
);
interface OnboardingConfig {
  docsUrl?: string;
  installUrl?: string;
  packageName?: string;
  packageVersion?: string;
  packageUrl?: string;
}
let savedConfig: OnboardingConfig = {};
try {
  savedConfig = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "onboarding.config.json"),
      "utf8",
    ),
  ) as OnboardingConfig;
} catch (error) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "ENOENT"
  ) {
    throw error;
  }
}
const publicLinks: OnboardingConfig = {
  docsUrl: valueAfter("--docs-url") ?? savedConfig.docsUrl,
  installUrl: valueAfter("--install-url") ?? savedConfig.installUrl,
  packageName: valueAfter("--package") ?? savedConfig.packageName,
  packageVersion:
    valueAfter("--package-version") ?? savedConfig.packageVersion,
  packageUrl: valueAfter("--package-url") ?? savedConfig.packageUrl,
};
const guideSource = readFileSync(
  resolve(process.cwd(), "public", "guide.html"),
  "utf8",
);
mkdirSync(outputDir, { recursive: true });
for (const obsoleteName of ["laguarde.zip", "laguarde.zip.sha256"]) {
  try {
    unlinkSync(resolve(outputDir, obsoleteName));
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}
writeFileSync(
  resolve(outputDir, "index.html"),
  buildStaticHumanGuide(
    guideSource,
    "http://127.0.0.1:3000",
    publicLinks,
  ),
);
writeFileSync(
  resolve(outputDir, "install"),
  buildNpmAgentInstallContract({
    packageName: publicLinks.packageName,
    packageVersion: publicLinks.packageVersion,
  }),
);

console.log(`Static onboarding export ready:
  ${resolve(outputDir, "index.html")}  (text/html)
  ${resolve(outputDir, "install")}     (text/plain)

The executable is distributed through npm; no ZIP or checksum is needed.
Public agent URL: ${publicLinks.installUrl ?? "(relative /install)"}
`);
