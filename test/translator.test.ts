import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedConfig } from "../src/config.js";
import { buildEndpoint, translate } from "../src/translator.js";

const config: ResolvedConfig = {
  urlTemplate: "https://example.invalid/{key}/translate",
  apiKey: "secret/key",
  defaultTarget: "ZH",
  timeoutMs: 2_000,
};

test("Key 只在请求时安全替换进 URL", () => {
  assert.equal(
    buildEndpoint(config.urlTemplate, config.apiKey),
    "https://example.invalid/secret%2Fkey/translate",
  );
});

test("翻译请求和 AI JSON 所需结果字段稳定", async () => {
  let requestedUrl = "";
  let requestedBody = "";
  const fakeFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = String(init?.body);
    return new Response(JSON.stringify({ code: 200, data: "你好" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await translate(
    config,
    { text: "Hello", sourceLang: "auto", targetLang: "zh" },
    fakeFetch,
  );
  assert.equal(requestedUrl, "https://example.invalid/secret%2Fkey/translate");
  assert.deepEqual(JSON.parse(requestedBody), {
    text: "Hello",
    source_lang: "auto",
    target_lang: "ZH",
  });
  assert.deepEqual(result, {
    data: "你好",
    sourceLang: "auto",
    targetLang: "ZH",
    provider: "deeplx-compatible",
  });
});

test("无效响应不会被当作成功", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ code: 200 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(
    translate(config, { text: "Hello", targetLang: "ZH" }, fakeFetch),
    /缺少字符串字段 data/,
  );
});
