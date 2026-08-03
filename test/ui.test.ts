import assert from "node:assert/strict";
import test from "node:test";

import { buildInteractiveFrame, getInteractiveMenuItems, type InteractiveMenuItem } from "../src/ui.js";

test("交互首页包含版本、配置状态、帮助和方向键提示", () => {
  const items: Array<InteractiveMenuItem<"help" | "exit">> = [
    { value: "help", label: "查看帮助", description: "显示所有命令" },
    { value: "exit", label: "退出", description: "结束程序" },
  ];
  const frame = buildInteractiveFrame({
    version: "0.1.0",
    initialized: false,
    items,
    selectedIndex: 0,
    color: false,
  });
  assert.match(frame, /TransX CLI v0\.1\.0/);
  assert.match(frame, /未配置/);
  assert.match(frame, /查看帮助/);
  assert.match(frame, /↑↓ 选择/);
});

test("未初始化时只显示安全可用的菜单项", () => {
  assert.deepEqual(
    getInteractiveMenuItems(false).map((item) => item.value),
    ["init", "update", "help", "exit"],
  );
});

test("初始化后开放翻译和配置菜单", () => {
  const actions = getInteractiveMenuItems(true).map((item) => item.value);
  assert.deepEqual(actions, ["translate", "init", "config", "update", "help", "exit"]);
});
