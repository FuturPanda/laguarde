import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

interface PackageManifest {
  name: string;
  version: string;
  mcpName?: string;
}

interface RegistryPackage {
  registryType: string;
  identifier: string;
  version: string;
  transport: { type: string };
}

interface ServerManifest {
  $schema: string;
  name: string;
  version: string;
  packages?: RegistryPackage[];
}

const projectDir = process.cwd();
const packageManifest = JSON.parse(
  await readFile(resolve(projectDir, "package.json"), "utf8"),
) as PackageManifest;
const serverManifest = JSON.parse(
  await readFile(resolve(projectDir, "server.json"), "utf8"),
) as ServerManifest;

const schemaResponse = await fetch(serverManifest.$schema);
if (!schemaResponse.ok) {
  throw new Error(
    `Could not download ${serverManifest.$schema}: HTTP ${schemaResponse.status}`,
  );
}
const schema = (await schemaResponse.json()) as object;
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(serverManifest)) {
  for (const error of validate.errors ?? []) {
    console.error(
      `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    );
  }
  process.exitCode = 1;
} else {
  const npmPackage = serverManifest.packages?.find(
    (entry) => entry.registryType === "npm",
  );
  const consistencyErrors = [
    serverManifest.name === packageManifest.mcpName
      ? null
      : "server.json name must equal package.json mcpName",
    serverManifest.version === packageManifest.version
      ? null
      : "server.json version must equal package.json version",
    npmPackage?.identifier === packageManifest.name
      ? null
      : "server.json npm identifier must equal package.json name",
    npmPackage?.version === packageManifest.version
      ? null
      : "server.json npm version must equal package.json version",
    npmPackage?.transport.type === "stdio"
      ? null
      : "The npm package transport must be stdio",
  ].filter((error): error is string => error !== null);

  if (consistencyErrors.length) {
    for (const error of consistencyErrors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(
      `server.json is schema-valid and consistent for ${serverManifest.name}@${serverManifest.version}`,
    );
  }
}
