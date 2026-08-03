import assert from "node:assert/strict";
import test from "node:test";

import { getBinDirectory, getConfigRoot } from "../src/paths.js";

test("Windows 安装目录与 luckin 风格一致", () => {
  const env = { LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local", USERPROFILE: "C:\\Users\\tester" };
  assert.equal(
    getBinDirectory("win32", env),
    "C:\\Users\\tester\\AppData\\Local\\.transx\\bin",
  );
  assert.equal(getConfigRoot(env, "win32"), "C:\\Users\\tester\\.transx");
});

test("macOS 和 Linux 使用用户目录下的 .transx", () => {
  const env = { HOME: "/Users/tester" };
  assert.equal(getBinDirectory("darwin", env), "/Users/tester/.transx/bin");
  assert.equal(getConfigRoot(env, "darwin"), "/Users/tester/.transx");
  assert.equal(getBinDirectory("linux", env), "/Users/tester/.transx/bin");
});
