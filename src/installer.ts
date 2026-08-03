import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { PACKAGE_NAME } from "./constants.js";
import { TransxError } from "./errors.js";
import { getBinDirectory } from "./paths.js";
import { getPackageInfo } from "./package-info.js";

const execFileAsync = promisify(execFile);

function quoteCmd(value: string): string {
  return value.replaceAll("%", "%%").replaceAll('"', '""');
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function ensureWindowsUserPath(binDirectory: string): Promise<void> {
  const powershell = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
  const script = [
    "$bin = $env:TRANSX_BIN_DIR",
    "$current = [Environment]::GetEnvironmentVariable('Path', 'User')",
    "$parts = @($current -split ';' | Where-Object { $_ })",
    "if ($parts -notcontains $bin) {",
    "  [Environment]::SetEnvironmentVariable('Path', (($parts + $bin) -join ';'), 'User')",
    "}",
  ].join("\n");
  await execFileAsync(powershell, ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, TRANSX_BIN_DIR: binDirectory },
  });
}

async function ensurePosixPath(binDirectory: string): Promise<void> {
  const shellName = path.basename(process.env.SHELL || "sh");
  const profile = path.join(os.homedir(), shellName === "zsh" ? ".zshrc" : ".bashrc");
  const marker = "# transx-cli user bin";
  let existing = "";
  try {
    existing = await readFile(profile, "utf8");
  } catch {
    // A missing profile will be created below.
  }
  if (!existing.includes(marker)) {
    const block = `\n${marker}\nexport PATH="${binDirectory}:$PATH"\n`;
    await writeFile(profile, `${existing}${block}`, "utf8");
  }
}

export async function installCurrentPackage(force = false): Promise<string> {
  const packageInfo = await getPackageInfo();
  const binDirectory = getBinDirectory();
  const versionDirectory = path.join(binDirectory, packageInfo.version);
  const targetDist = path.join(versionDirectory, "dist");
  if (force) {
    await rm(versionDirectory, { recursive: true, force: true });
  }
  await mkdir(versionDirectory, { recursive: true, mode: 0o700 });

  try {
    await cp(path.join(packageInfo.root, "dist"), targetDist, {
      recursive: true,
      force,
      errorOnExist: !force,
    });
    await cp(path.join(packageInfo.root, "package.json"), path.join(versionDirectory, "package.json"), {
      force,
      errorOnExist: !force,
    });
  } catch (error) {
    throw new TransxError(
      "INSTALL_ERROR",
      force ? "无法覆盖现有 TransX 安装" : "该版本已安装；如需覆盖请添加 --force",
      5,
      { cause: error },
    );
  }

  const cliPath = path.join(targetDist, "cli.js");
  if (process.platform === "win32") {
    const launcher = `@echo off\r\nnode "${quoteCmd(cliPath)}" %*\r\n`;
    await writeFile(path.join(binDirectory, "transx.cmd"), launcher, "utf8");
    await ensureWindowsUserPath(binDirectory);
  } else {
    const launcherPath = path.join(binDirectory, "transx");
    await writeFile(launcherPath, `#!/bin/sh\nexec node ${quoteShell(cliPath)} "$@"\n`, {
      encoding: "utf8",
      mode: 0o755,
    });
    await ensurePosixPath(binDirectory);
  }

  return binDirectory;
}

export async function getLatestVersion(): Promise<string> {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    const { stdout } = await execFileAsync(npmCommand, ["view", PACKAGE_NAME, "version", "--json"]);
    return String(JSON.parse(stdout)).trim();
  } catch (error) {
    throw new TransxError("UPDATE_ERROR", "无法从 npm Registry 获取最新版本", 5, { cause: error });
  }
}

export async function updateFromRegistry(): Promise<void> {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    await execFileAsync(
      npmCommand,
      ["exec", "--yes", `--package=${PACKAGE_NAME}@latest`, "--", "transx", "install", "--force"],
      { windowsHide: true },
    );
  } catch (error) {
    throw new TransxError("UPDATE_ERROR", "更新失败，请检查 npm 和网络状态", 5, { cause: error });
  }
}
