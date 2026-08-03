#!/usr/bin/env node

import { stderr, stdout } from "node:process";
import path from "node:path";

import { ConfigStore } from "./config.js";
import { FILE_REQUEST_DELAY_MS, FILE_TRANSLATION_CONCURRENCY } from "./constants.js";
import { TransxError, toTransxError } from "./errors.js";
import {
  prepareFileTranslation,
  translatedText,
  writeTranslatedFile,
} from "./file-document.js";
import { runHistoryCommand } from "./history-command.js";
import { HistoryStore } from "./history.js";
import { promptSecret, promptText, promptTranslationContinue, readStdin } from "./input.js";
import { getLatestVersion, installCurrentPackage, updateFromRegistry } from "./installer.js";
import { getLanguagesJson, getLanguagesText } from "./languages.js";
import { getPackageInfo } from "./package-info.js";
import { translate } from "./translator.js";
import {
  buildInteractiveFrame,
  clearScreen,
  getInteractiveMenuItems,
  selectInteractiveMenu,
  type InteractiveAction,
} from "./ui.js";

const DISCLAIMER = "TransX CLI — DLX 翻译工具";

const HELP = `${DISCLAIMER}

Usage:
  transx [command]

Commands:
  transx                       打开交互界面
  init                         初始化 DLX API Key
  translate <text>             翻译文本；未传 text 时读取 stdin
  translate --file <path>      从文件提取文本后翻译（txt/md/csv/log/docx/xlsx/pptx/pdf）
  languages [--json]           查看支持的源语言和目标语言
  history [options]            查看翻译历史
  history search <keyword>     搜索原文和译文
  history status               查看历史文件状态
  history clear <options>      按条数或时间清理历史
  history help                 显示历史命令帮助
  config                       查看完整配置和 API Key
  config set-key [--stdin]     隐藏输入或从 stdin 设置 API Key
  config reset <key|all>       重置 Key 或全部配置
  install [--force]            安装到用户目录并加入 PATH
  version [--check]            显示版本，可检查 npm 最新版本
  update                       从 npm Registry 更新到最新版
  help                         显示帮助

Translate Options:
  -t, --to <lang>              目标语言（必填）
  -s, --source <lang>          源语言（默认 auto）
  -f, --file <path>            从文件提取文本翻译（与位置文本互斥）
  -o, --output <path>          译文文件路径
      --json                   输出适合 AI 读取的 JSON
      --timeout <seconds>      本次请求超时
  -h, --help                   显示帮助

File Limits:
  文件最大 20MB；可翻译文本最大 100000 字符；最多 500 次请求

Examples:
  transx init
  transx translate "Hello world" --to ZH --json
  echo "Hello world" | transx translate --to ZH --json
  transx translate --file ./readme.md --to ZH --json
  transx translate --file ./report.docx --to ZH
  transx translate --file ./report.docx --to ZH --output ./report.zh.docx
  transx languages --json
  transx history --limit 20
  transx history --from "2026-08-01" --to "2026-08-03"
  transx history search "环境审查" --json
  transx history clear --older-than 30d --yes
`;

interface TranslateArguments {
  text?: string;
  file?: string;
  output?: string;
  target?: string;
  source?: string;
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
    } else if (arg === "-f" || arg === "--file") {
      parsed.file = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === "-o" || arg === "--output") {
      parsed.output = requireOptionValue(args, index, arg);
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
  if (parsed.file && parsed.text) {
    throw new TransxError("INVALID_ARGUMENT", "--file 与位置文本不能同时使用", 2);
  }
  if (parsed.output && !parsed.file) {
    throw new TransxError("INVALID_ARGUMENT", "--output 只能与 --file 一起使用", 2);
  }
  return parsed;
}

async function runInit(store: ConfigStore, args: string[]): Promise<void> {
  const apiKey = args.includes("--key-stdin")
    ? await readStdin()
    : await promptSecret("DLX API Key（获取：https://connect.linux.do/）：");
  await store.setApiKey(apiKey);
  stdout.write(`配置已保存到 ${store.directory}\n`);
}

async function runConfig(store: ConfigStore, args: string[]): Promise<void> {
  const action = args[0];
  if (!action) {
    stdout.write(`${JSON.stringify(await store.statusWithApiKey(), null, 2)}\n`);
    return;
  }
  if (action === "set-key") {
    const apiKey = args.includes("--stdin")
      ? await readStdin()
      : await promptSecret("DLX API Key（获取：https://connect.linux.do/）：");
    await store.setApiKey(apiKey);
    stdout.write("API Key 已保存\n");
    return;
  }
  if (action === "reset") {
    const target = args[1];
    if (target === "key") await store.resetKey();
    else if (target === "all") await store.resetAll();
    else throw new TransxError("INVALID_ARGUMENT", "reset 仅支持 key 或 all", 2);
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
  const requestedTarget = parsed.target;
  const config = await store.resolve();
  if (parsed.file) {
    const prepared = await prepareFileTranslation(parsed.file);
    stderr.write(`文件翻译速度较慢，共 ${prepared.units.length} 个请求\n`);
    const translations: string[] = new Array(prepared.units.length);
    let sourceLang = parsed.source || "auto";
    let targetLang = requestedTarget;
    let provider = "dlx";
    let nextIndex = 0;
    let completed = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < prepared.units.length) {
        const index = nextIndex;
        nextIndex += 1;
        const result = await translate(config, {
          text: prepared.units[index]?.text ?? "",
          targetLang: requestedTarget,
          ...(parsed.source ? { sourceLang: parsed.source } : {}),
          ...(parsed.timeoutMs ? { timeoutMs: parsed.timeoutMs } : {}),
        });
        translations[index] = result.data;
        sourceLang = result.sourceLang;
        targetLang = result.targetLang;
        provider = result.provider;
        completed += 1;
        stderr.write(`翻译进度 ${completed}/${prepared.units.length}\n`);
        if (nextIndex < prepared.units.length) {
          await new Promise((resolve) => setTimeout(resolve, FILE_REQUEST_DELAY_MS));
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(FILE_TRANSLATION_CONCURRENCY, prepared.units.length) }, worker),
    );
    const data = translatedText(prepared, translations);
    const written = await writeTranslatedFile(prepared, translations, targetLang, parsed.output);
    try {
      const warning = await new HistoryStore(store.directory).append({
        sourceLang,
        targetLang,
        format: "file",
        sourceFilePath: prepared.sourcePath,
        sourceFileName: path.basename(prepared.sourcePath),
        outputFilePath: written.outputPath,
        outputFileName: written.outputPath ? path.basename(written.outputPath) : null,
      });
      if (warning) stderr.write(`历史提醒：${warning}\n`);
    } catch (error) {
      stderr.write(`历史记录写入失败：${toTransxError(error).message}\n`);
    }
    if (parsed.json) {
      stdout.write(`${JSON.stringify({
        ok: true,
        data,
        source_lang: sourceLang,
        target_lang: targetLang,
        provider,
        output_file: written.outputPath,
        output_format: prepared.outputExtension.slice(1),
        fallback: written.fallback,
      })}\n`);
    } else if (written.outputPath) {
      stdout.write(`译文已保存：${written.outputPath}\n`);
    } else {
      stderr.write("无法写入译文文件，已返回文本\n");
      stdout.write(`${data}\n`);
    }
    return;
  }
  const text = parsed.text || (process.stdin.isTTY ? "" : await readStdin());
  const result = await translate(config, {
    text,
    targetLang: requestedTarget,
    ...(parsed.source ? { sourceLang: parsed.source } : {}),
    ...(parsed.timeoutMs ? { timeoutMs: parsed.timeoutMs } : {}),
  });
  try {
    const warning = await new HistoryStore(store.directory).append({
      sourceLang: result.sourceLang,
      targetLang: result.targetLang,
      format: "plain",
      input: text,
      output: result.data,
    });
    if (warning) stderr.write(`历史提醒：${warning}\n`);
  } catch (error) {
    const historyError = toTransxError(error);
    stderr.write(`历史记录写入失败：${historyError.message}\n`);
  }
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
    if (action === "translate" || action === "translate_file") {
      let continueTranslating = true;
      while (continueTranslating) {
        renderInteractivePage(
          packageInfo.version,
          status.initialized,
          items,
          action === "translate" ? "翻译文本" : "翻译文件",
        );
        try {
          if (action === "translate") {
            const text = await promptText("待翻译文本：");
            const target = (await promptText("目标语言 示例：[EN/ZH]：")) || "ZH";
            await runTranslate(store, [text, "--to", target]);
          } else {
            const filePath = await promptText("文件路径：");
            const target = (await promptText("目标语言 示例：[EN/ZH]：")) || "ZH";
            await runTranslate(store, ["--file", filePath, "--to", target]);
          }
        } catch (error) {
          const transxError = toTransxError(error);
          stderr.write(`\n错误 [${transxError.code}]：${transxError.message}\n`);
        }
        continueTranslating = await promptTranslationContinue();
      }
      continue;
    }
    try {
      if (action === "init") {
        renderInteractivePage(packageInfo.version, status.initialized, items, "初始化 / 修改配置");
        await runInit(store, []);
      } else if (action === "config") {
        renderInteractivePage(packageInfo.version, status.initialized, items, "当前配置");
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
    case "history":
      await runHistoryCommand(store.directory, commandArgs);
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
