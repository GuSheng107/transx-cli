import { stdin, stderr } from "node:process";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";

import { TransxError } from "./errors.js";

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

export async function promptText(prompt: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stderr });
  try {
    return (await readline.question(prompt)).trim();
  } finally {
    readline.close();
  }
}

export async function promptTranslationContinue(): Promise<boolean> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") return false;
  stderr.write("\nEnter 继续翻译 · Esc 返回主菜单");
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return await new Promise<boolean>((resolve, reject) => {
    const cleanup = (): void => {
      stdin.removeListener("keypress", onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
    };
    const onKeypress = (_input: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new TransxError("CANCELLED", "操作已取消", 130));
      } else if (key.name === "escape") {
        cleanup();
        resolve(false);
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(true);
      }
    };
    stdin.on("keypress", onKeypress);
  });
}

export async function promptSecret(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new TransxError("INVALID_ARGUMENT", "非交互环境请使用 --stdin 提供 API Key", 2);
  }

  stderr.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const cleanup = (): void => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new TransxError("CANCELLED", "操作已取消", 130));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value.trim());
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stderr.write("\b \b");
          }
          continue;
        }
        value += character;
        stderr.write("*");
      }
    };
    stdin.on("data", onData);
  });
}
