import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";

import { TransxError } from "./errors.js";

export interface InteractiveMenuItem<T extends string = string> {
  value: T;
  label: string;
  description: string;
}

export type InteractiveAction =
  | "translate"
  | "translate_file"
  | "init"
  | "config"
  | "update"
  | "help"
  | "exit";

const UNINITIALIZED_MENU_ITEMS: Array<InteractiveMenuItem<InteractiveAction>> = [
  { value: "init", label: "初始化", description: "设置 DLX API Key" },
  { value: "update", label: "检查版本更新", description: "比较 npm Registry 最新版本" },
  { value: "help", label: "查看帮助", description: "显示所有命令与参数" },
  { value: "exit", label: "退出", description: "结束 TransX CLI" },
];

const INITIALIZED_MENU_ITEMS: Array<InteractiveMenuItem<InteractiveAction>> = [
  { value: "translate", label: "翻译文本", description: "输入文本并选择目标语言" },
  { value: "translate_file", label: "翻译文件", description: "输入文件路径并选择目标语言" },
  { value: "init", label: "重新初始化", description: "重新设置 DLX API Key" },
  { value: "config", label: "查看 / 更改配置", description: "查看完整配置或维护 API Key" },
  { value: "update", label: "检查版本更新", description: "比较 npm Registry 最新版本" },
  { value: "help", label: "查看帮助", description: "显示所有命令与参数" },
  { value: "exit", label: "退出", description: "结束 TransX CLI" },
];

export function getInteractiveMenuItems(initialized: boolean): Array<InteractiveMenuItem<InteractiveAction>> {
  return initialized ? INITIALIZED_MENU_ITEMS : UNINITIALIZED_MENU_ITEMS;
}

interface Keypress {
  name?: string;
  ctrl?: boolean;
}

const ANSI = {
  clear: "\u001b[2J\u001b[H",
  hideCursor: "\u001b[?25l",
  showCursor: "\u001b[?25h",
  reset: "\u001b[0m",
  blue: "\u001b[38;2;65;112;255m",
  lime: "\u001b[38;2;184;255;57m",
  white: "\u001b[38;2;238;242;255m",
  dim: "\u001b[38;2;126;137;166m",
  border: "\u001b[38;2;83;100;151m",
};

const LOGO = [
  "████████╗██████╗  █████╗ ███╗   ██╗███████╗██╗  ██╗",
  "╚══██╔══╝██╔══██╗██╔══██╗████╗  ██║██╔════╝╚██╗██╔╝",
  "   ██║   ██████╔╝███████║██╔██╗ ██║███████╗ ╚███╔╝ ",
  "   ██║   ██╔══██╗██╔══██║██║╚██╗██║╚════██║ ██╔██╗ ",
  "   ██║   ██║  ██║██║  ██║██║ ╚████║███████║██╔╝ ██╗",
  "   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝",
];

function paint(value: string, color: keyof typeof ANSI, enabled: boolean): string {
  return enabled ? `${ANSI[color]}${value}${ANSI.reset}` : value;
}

export function buildInteractiveFrame<T extends string>(options: {
  version: string;
  initialized: boolean;
  items: Array<InteractiveMenuItem<T>>;
  selectedIndex: number;
  color?: boolean;
}): string {
  const color = options.color ?? true;
  const status = options.initialized ? "已配置" : "未配置 · 请先初始化";
  const menu = options.items.map((item, index) => {
    const selected = index === options.selectedIndex;
    const cursor = selected ? paint("❯", "lime", color) : " ";
    const number = `${index + 1}.`;
    const paddedLabel = item.label.padEnd(18);
    const label = selected ? paint(paddedLabel, "white", color) : paddedLabel;
    const description = paint(item.description, "dim", color);
    return `${cursor} ${number} ${label} ${description}`;
  });

  return [
    paint(LOGO.join("\n"), "blue", color),
    `${paint(`TransX CLI v${options.version}`, "white", color)}  ${paint(status, options.initialized ? "lime" : "dim", color)}`,
    "",
    paint("┌──────────────────────────────┐", "border", color),
    `${paint("│", "border", color)}  欢迎使用 TransX CLI         ${paint("│", "border", color)}`,
    paint("└──────────────────────────────┘", "border", color),
    paint("DLX 翻译", "dim", color),
    "",
    ...menu,
    "",
    paint("↑↓ 选择 · Enter 确认 · Esc 退出 · 数字键直达", "dim", color),
  ].join("\n");
}

export function clearScreen(): void {
  stdout.write(ANSI.clear);
}

export async function selectInteractiveMenu<T extends string>(options: {
  version: string;
  initialized: boolean;
  items: Array<InteractiveMenuItem<T>>;
}): Promise<T | null> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    return null;
  }

  const color = !process.env.NO_COLOR;
  let selectedIndex = 0;
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  const render = (): void => {
    stdout.write(
      `${ANSI.clear}${ANSI.hideCursor}${buildInteractiveFrame({ ...options, selectedIndex, color })}`,
    );
  };

  render();
  return await new Promise<T | null>((resolve, reject) => {
    const cleanup = (): void => {
      stdin.removeListener("keypress", onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(`${ANSI.showCursor}\n`);
    };
    const finish = (value: T | null): void => {
      cleanup();
      resolve(value);
    };
    const onKeypress = (input: string, key: Keypress): void => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new TransxError("CANCELLED", "操作已取消", 130));
        return;
      }
      if (key.name === "escape") {
        finish(null);
        return;
      }
      if (key.name === "up") {
        selectedIndex = (selectedIndex - 1 + options.items.length) % options.items.length;
        render();
        return;
      }
      if (key.name === "down") {
        selectedIndex = (selectedIndex + 1) % options.items.length;
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish(options.items[selectedIndex]?.value ?? null);
        return;
      }
      const numericIndex = Number(input) - 1;
      if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < options.items.length) {
        finish(options.items[numericIndex]?.value ?? null);
      }
    };
    stdin.on("keypress", onKeypress);
  });
}
