import assert from "node:assert/strict";
import test from "node:test";

import {
  getLanguagesJson,
  getLanguagesText,
  TARGET_LANGUAGE_ALIASES,
  TARGET_LANGUAGES,
} from "../src/languages.js";

test("语言命令提供 DeepLX 当前支持的 37 个目标代码", () => {
  assert.equal(TARGET_LANGUAGES.length, 37);
  assert.deepEqual(TARGET_LANGUAGE_ALIASES, { EN: "EN-US", PT: "PT-BR" });
  assert.match(getLanguagesText(), /ZH-HANT\s+繁体中文/);
});

test("语言命令 JSON 输出适合 AI 读取", () => {
  const result = JSON.parse(getLanguagesJson()) as {
    ok: boolean;
    data: { target_count: number; source_auto: boolean };
  };
  assert.equal(result.ok, true);
  assert.equal(result.data.target_count, 37);
  assert.equal(result.data.source_auto, true);
});
