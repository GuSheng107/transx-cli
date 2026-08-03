import assert from "node:assert/strict";
import test from "node:test";

import {
  getLanguagesJson,
  getLanguagesText,
  TARGET_LANGUAGES,
} from "../src/languages.js";

test("语言命令提供经实测筛选的 32 个目标代码", () => {
  assert.equal(TARGET_LANGUAGES.length, 32);
  assert.match(getLanguagesText(), /ZH-HANT\s+繁体中文/);
  assert.match(getLanguagesText(), /EN\s+英语/);
  assert.match(getLanguagesText(), /PT\s+葡萄牙语/);
  assert.match(getLanguagesText(), /NB\s+挪威博克马尔语/);
  assert.doesNotMatch(getLanguagesText(), /EN-US/);
  assert.doesNotMatch(getLanguagesText(), /PT-BR/);
  assert.doesNotMatch(getLanguagesText(), /ES-419/);
  assert.doesNotMatch(getLanguagesText(), /HE\b/);
  assert.doesNotMatch(getLanguagesText(), /VI\b/);
});

test("语言命令 JSON 输出适合 AI 读取", () => {
  const result = JSON.parse(getLanguagesJson()) as {
    ok: boolean;
    data: { target_count: number; source_auto: boolean };
  };
  assert.equal(result.ok, true);
  assert.equal(result.data.target_count, 32);
  assert.equal(result.data.source_auto, true);
});
