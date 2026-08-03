import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ConfigStore, maskApiKey, validateUrlTemplate } from "../src/config.js";

test("URL 模板必须包含 key 占位符", () => {
  assert.throws(() => validateUrlTemplate("https://example.invalid/translate"));
  assert.equal(
    validateUrlTemplate("https://example.invalid/{key}/translate"),
    "https://example.invalid/{key}/translate",
  );
});

test("配置和凭据可以分别保存与重置", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "transx-config-"));
  const store = new ConfigStore(directory);
  try {
    await store.setUrlTemplate("https://example.invalid/{key}/translate");
    await store.setApiKey("abcdefgh12345678");
    const resolved = await store.resolve({});
    assert.equal(resolved.apiKey, "abcdefgh12345678");
    assert.equal(resolved.urlTemplate, "https://example.invalid/{key}/translate");

    await store.resetKey();
    const statusAfterKeyReset = await store.status({});
    assert.equal(statusAfterKeyReset.urlTemplate, "https://example.invalid/{key}/translate");
    assert.equal(statusAfterKeyReset.maskedApiKey, null);

    await store.setApiKey("abcdefgh12345678");
    await store.resetUrl();
    const statusAfterUrlReset = await store.status({});
    assert.equal(statusAfterUrlReset.urlTemplate, null);
    assert.equal(statusAfterUrlReset.maskedApiKey, "abcd********5678");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("环境变量覆盖本地配置，状态支持脱敏与完整 Key", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "transx-env-"));
  const store = new ConfigStore(directory);
  try {
    await store.setUrlTemplate("https://local.invalid/{key}/translate");
    await store.setApiKey("local-secret-key");
    const status = await store.status({
      DEEPLX_URL_TEMPLATE: "https://env.invalid/{key}/translate",
      DEEPLX_API_KEY: "environment-secret-key",
    });
    assert.equal(status.urlSource, "environment");
    assert.equal(status.keySource, "environment");
    assert.equal(status.urlTemplate, "https://env.invalid/{key}/translate");
    assert.equal(status.maskedApiKey, maskApiKey("environment-secret-key"));
    assert.ok(!JSON.stringify(status).includes("environment-secret-key"));

    const revealedStatus = await store.statusWithApiKey({
      DEEPLX_URL_TEMPLATE: "https://env.invalid/{key}/translate",
      DEEPLX_API_KEY: "environment-secret-key",
    });
    assert.equal(revealedStatus.apiKey, "environment-secret-key");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
