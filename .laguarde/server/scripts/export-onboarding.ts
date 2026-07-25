import {
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { buildLocalAgentInstallContract } from "../src/install.js";
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
  archiveUrl?: string;
  checksumUrl?: string;
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
  archiveUrl: valueAfter("--archive-url") ?? savedConfig.archiveUrl,
  checksumUrl:
    valueAfter("--checksum-url") ?? savedConfig.checksumUrl,
};
const guideSource = readFileSync(
  resolve(process.cwd(), "public", "guide.html"),
  "utf8",
);
const archiveName = "laguarde.zip";
const checksumName = `${archiveName}.sha256`;
const archivePath = resolve(outputDir, archiveName);
const checksumPath = resolve(outputDir, checksumName);
const packageEntries = [
  ".dockerignore",
  ".gitignore",
  "Dockerfile",
  "README.md",
  "bun.lock",
  "compose.yaml",
  "docs",
  "examples",
  "llms.txt",
  "onboarding.config.json",
  "package.json",
  "public",
  "scripts",
  "src",
  "test",
  "tsconfig.json",
];

mkdirSync(outputDir, { recursive: true });
try {
  unlinkSync(archivePath);
} catch (error) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "ENOENT"
  ) {
    throw error;
  }
}

const zip = Bun.spawn(
  ["zip", "-q", "-r", archivePath, ...packageEntries],
  {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  },
);
const zipExitCode = await zip.exited;
if (zipExitCode !== 0) {
  throw new Error(
    "Could not create laguarde.zip. Install the standard 'zip' command and retry.",
  );
}

const archive = readFileSync(archivePath);
const checksum = createHash("sha256").update(archive).digest("hex");
writeFileSync(checksumPath, `${checksum}  ${archiveName}\n`);
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
  buildLocalAgentInstallContract({
    archiveName,
    checksumName,
    archiveUrl: publicLinks.archiveUrl,
    checksumUrl: publicLinks.checksumUrl,
  }),
);

console.log(`Static onboarding export ready:
  ${resolve(outputDir, "index.html")}  (text/html)
  ${resolve(outputDir, "install")}     (text/plain)
  ${archivePath}  (application/zip)
  ${checksumPath}  (text/plain)

No hosted Laguarde server URL is required.
Public agent URL: ${publicLinks.installUrl ?? "(relative /install)"}
`);
