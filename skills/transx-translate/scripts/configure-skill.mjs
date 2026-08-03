#!/usr/bin/env node

import { chmod, copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.dirname(scriptDirectory);
const assets = path.join(skillRoot, "assets");
const preference = path.join(os.homedir(), ".transx", "skill-preference.json");

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    if (process.platform !== "win32") await chmod(temporary, 0o600);
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function replaceSkill(templateName) {
  const target = path.join(skillRoot, "SKILL.md");
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await copyFile(path.join(assets, templateName), temporary);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function main() {
  const mode = process.argv[2];
  if (!new Set(["cli", "script", "reset"]).has(mode)) {
    process.stderr.write("usage: configure-skill.mjs <cli|script|reset>\n");
    process.exitCode = 2;
    return;
  }

  if (mode === "reset") {
    await rm(preference, { force: true });
    await replaceSkill("SKILL.original.md");
    process.stdout.write(`${JSON.stringify({ ok: true, configured: false })}\n`);
    return;
  }

  const runtime = mode === "cli" ? null : "node";
  await writeJsonAtomic(preference, { version: 1, mode, runtime });
  await replaceSkill(mode === "cli" ? "SKILL.cli.md" : "SKILL.node.md");
  process.stdout.write(`${JSON.stringify({ ok: true, mode, runtime })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
