#!/usr/bin/env node

import { stderr, stdout } from "node:process";

import { ConfigStore } from "./config.js";
import { TransxError, toTransxError } from "./errors.js";
import { promptSecret, promptText, readStdin } from "./input.js";
import { getLatestVersion, installCurrentPackage, updateFromRegistry } from "./installer.js";
import { getLanguagesJson, getLanguagesText } from "./languages.js";
import { getPackageInfo } from "./package-info.js";
import { translate, type ContentFormat } from "./translator.js";
import {
  buildInteractiveFrame,
  clearScreen,
  getInteractiveMenuItems,
  selectInteractiveMenu,
  type InteractiveAction,
} from "./ui.js";

const DISCLAIMER = "TransX CLI — DeepLX 特供版";

const HELP = `${DISCLAIMER}

Usage:
  transx [command]

Commands:
  transx                       打开交互界面
  init                         初始化 URL 和 API Key
  translate <text>             翻译文本；未传 text 时读取 stdin
  languages [--json]           查看支持的源语言和目标语言
  config                       查看脱敏配置和配置路径
  config set-url [url]         设置包含 {key} 的 URL 模板
  config set-key [--stdin]     隐藏输入或从 stdin 设置 API Key
  config reset <url|key|all>   重置 URL、Key 或全部配置
  install [--force]            安装到用户目录并加入 PATH
  version [--check]            显示版本，可检查 npm 最新版本
  update                       从 npm Registry 更新到最新版
  help                         显示帮助

Translate Options:
  -t, --to <lang>              目标语言（必填）
  -s, --source <lang>          源语言（默认 auto）
      --format <plain|html|xml> 内容格式（默认 plain）
      --json                   输出适合 AI 读取的 JSON
      --timeout <seconds>      本次请求超时
  -h, --help                   显示帮助

Examples:
  transx init
  transx translate "Hello world" --to ZH --json
  echo "Hello world" | transx translate --to ZH --json
  transx languages --json
`;

interface TranslateArguments {
  text?: string;
  target?: string;
  source?: string;
  format?: ContentFormat;
  json: boolean;
  timeoutMs?: number;
}

function requireOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new TransxError("INVALID_ARGUMENT", `${option} 缺少参数值`, 2);
  }
  return value;
}

function parseTranslateArguments(args: string[]): TranslateArguments {
  const parsed: TranslateArguments = { json: false };
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "-t" || arg === "--to") {
      parsed.target = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === "-s" || arg === "--source") {
      parsed.source = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === "--format") {
      parsed.format = requireOptionValue(args, index, arg) as ContentFormat;
      index += 1;
    } else if (arg === "--timeout") {
      const seconds = Number(requireOptionValue(args, index, arg));
      index += 1;
      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new TransxError("INVALID_ARGUMENT", "--timeout 必须是正数秒", 2);
      }
      parsed.timeoutMs = Math.round(seconds * 1000);
    } else if (arg?.startsWith("-")) {
      throw new TransxError("INVALID_ARGUMENT", `未知参数：${arg}`, 2);
    } else if (arg !== undefined) {
      positional.push(arg);
    }
  }
  if (positional.length > 0) {
    parsed.text = positional.join(" ");
  }
  return parsed;
}

async function runInit(store: ConfigStore, args: string[]): Promise<void> {
  const urlFlagIndex = args.indexOf("--url");
  const url = urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : await promptText("DeepLX URL 模板（必须包含 {key}）：");
  if (!url) {
    throw new TransxError("INVALID_ARGUMENT", "URL 模板不能为空", 2);
  }
  const apiKey = args.includes("--key-stdin")
    ? await readStdin()
    : await promptSecret("DeepLX API Key：");
  await store.setUrlTemplate(url);
  await store.setApiKey(apiKey);
  stdout.write(`配置已保存到 ${store.directory}\n`);
}

async function runConfig(store: ConfigStore, args: string[]): Promise<void> {
  const action = args[0];
  if (!action) {
    stdout.write(`${JSON.stringify(await store.status(), null, 2)}\n`);
    return;
  }
  if (action === "set-url") {
    const url = args[1] || (await promptText("DeepLX URL 模板（必须包含 {key}）："));
    await store.setUrlTemplate(url);
    stdout.write("URL 模板已保存\n");
    return;
  }
  if (action === "set-key") {
    const apiKey = args.includes("--stdin") ? await readStdin() : await promptSecret("DeepLX API Key：");
    await store.setApiKey(apiKey);
    stdout.write("API Key 已保存\n");
    return;
  }
  if (action === "reset") {
    const target = args[1];
    if (target === "url") await store.resetUrl();
    else if (target === "key") await store.resetKey();
    else if (target === "all") await store.resetAll();
    else throw new TransxError("INVALID_ARGUMENT", "reset 仅支持 url、key 或 all", 2);
    stdout.write(`${target} 配置已重置\n`);
    return;
  }
  throw new TransxError("INVALID_ARGUMENT", `未知 config 操作：${action}`, 2);
}

async function runTranslate(store: ConfigStore, args: string[]): Promise<void> {
  if (args.includes("-h") || args.includes("--help")) {
    stdout.write(HELP);
    return;
  }
  const parsed = parseTranslateArguments(args);
  if (!parsed.target) {
    throw new TransxError("INVALID_ARGUMENT", "必须通过 --to 指定目标语言", 2);
  }
  const text = parsed.text || (process.stdin.isTTY ? "" : await readStdin());
  const config = await store.resolve();
  const result = await translate(config, {
    text,
    targetLang: parsed.target,
    ...(parsed.source ? { sourceLang: parsed.source } : {}),
    ...(parsed.format ? { format: parsed.format } : {}),
    ...(parsed.timeoutMs ? { timeoutMs: parsed.timeoutMs } : {}),
  });
  if (parsed.json) {
    stdout.write(
      `${JSON.stringify({
        ok: true,
        data: result.data,
        source_lang: result.sourceLang,
        target_lang: result.targetLang,
        provider: result.provider,
      })}\n`,
    );
  } else {
    stdout.write(`${result.data}\n`);
  }
}

async function pauseInteractive(): Promise<void> {
  await promptText("\n按 Enter 返回主菜单…");
}

function renderInteractivePage(
  version: string,
  initialized: boolean,
  items: ReturnType<typeof getInteractiveMenuItems>,
  content: string,
): void {
  clearScreen();
  stdout.write(
    `${buildInteractiveFrame({
      version,
      initialized,
      items,
      selectedIndex: -1,
      color: !process.env.NO_COLOR,
    }).split("\n").slice(0, 10).join("\n")}\n\n${content}\n`,
  );
}

async function runInteractive(store: ConfigStore): Promise<void> {
  const packageInfo = await getPackageInfo();
  while (true) {
    const status = await store.status();
    const items = getInteractiveMenuItems(status.initialized);
    const action = await selectInteractiveMenu({
      version: packageInfo.version,
      initialized: status.initialized,
      items,
    });
    if (!action || action === "exit") {
      clearScreen();
      stdout.write("TransX 已退出。\n");
      return;
    }

    clearScreen();
    try {
      if (action === "translate") {
        renderInteractivePage(packageInfo.version, status.initialized, items, "翻译文本");
        const text = await promptText("待翻译文本：");
        const target = (await promptText("目标语言 [ZH]：")) || "ZH";
        await runTranslate(store, [text, "--to", target]);
      } else if (action === "init") {
        renderInteractivePage(packageInfo.version, status.initialized, items, "初始化 / 修改配置");
        await runInit(store, []);
      } else if (action === "config") {
        renderInteractivePage(packageInfo.version, status.initialized, items, "当前脱敏配置");
        await runConfig(store, []);
      } else if (action === "update") {
        renderInteractivePage(packageInfo.version, status.initialized, items, "检查版本更新");
        const latest = await getLatestVersion();
        stdout.write(
          latest === packageInfo.version
            ? `已是最新版本（v${packageInfo.version}）\n`
            : `发现新版本 ${latest}，运行 transx update 更新\n`,
        );
      } else if (action === "help") {
        clearScreen();
        stdout.write(HELP);
      }
    } catch (error) {
      const transxError = toTransxError(error);
      stderr.write(`\n错误 [${transxError.code}]：${transxError.message}\n`);
    }
    await pauseInteractive();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      await runInteractive(new ConfigStore());
    } else {
      stdout.write(HELP);
    }
    return;
  }
  const commandArgs = args.slice(1);
  const store = new ConfigStore();

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      stdout.write(HELP);
      return;
    case "init":
      await runInit(store, commandArgs);
      return;
    case "config":
      await runConfig(store, commandArgs);
      return;
    case "translate":
      await runTranslate(store, commandArgs);
      return;
    case "languages":
      if (commandArgs.some((arg) => arg !== "--json")) {
        throw new TransxError("INVALID_ARGUMENT", "languages 仅支持 --json", 2);
      }
      stdout.write(`${commandArgs.includes("--json") ? getLanguagesJson() : getLanguagesText()}\n`);
      return;
    case "install": {
      const directory = await installCurrentPackage(commandArgs.includes("--force"));
      stdout.write(`TransX 已安装到 ${directory}\n请重新打开终端使 PATH 生效。\n`);
      return;
    }
    case "version": {
      const current = (await getPackageInfo()).version;
      stdout.write(`transx ${current}\n`);
      if (commandArgs.includes("--check")) {
        const latest = await getLatestVersion();
        stdout.write(latest === current ? "已是最新版本\n" : `发现新版本 ${latest}，运行 transx update 更新\n`);
      }
      return;
    }
    case "update":
      await updateFromRegistry();
      stdout.write("TransX 已更新到最新版本\n");
      return;
    default:
      throw new TransxError("INVALID_ARGUMENT", `未知命令：${command}。运行 transx help 查看用法`, 2);
  }
}

main().catch((error: unknown) => {
  const transxError = toTransxError(error);
  const jsonOutput = process.argv.includes("--json");
  if (jsonOutput) {
    stderr.write(`${JSON.stringify({ ok: false, error: { code: transxError.code, message: transxError.message } })}\n`);
  } else {
    stderr.write(`错误 [${transxError.code}]：${transxError.message}\n`);
  }
  process.exitCode = transxError.exitCode;
});
