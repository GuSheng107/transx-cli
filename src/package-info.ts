import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface PackageInfo {
  name: string;
  version: string;
  root: string;
}

export async function getPackageInfo(): Promise<PackageInfo> {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(moduleDirectory, "..");
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    name: string;
    version: string;
  };
  return { ...packageJson, root };
}
