import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ConfigStore, maskApiKey } from "../src/config.js";
import { DLX_URL_TEMPLATE } from "../src/constants.js";

test("API Key 可以保存、重置，URL 模板固定不可变", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "transx-config-"));
  const store = new ConfigStore(directory);
  try {
    await store.setApiKey("abcdefgh12345678");
    const resolved = await store.resolve({});
    assert.equal(resolved.apiKey, "abcdefgh12345678");
    assert.equal(resolved.urlTemplate, DLX_URL_TEMPLATE);

    await store.resetKey();
    const statusAfterKeyReset = await store.status({});
    assert.equal(statusAfterKeyReset.urlTemplate, DLX_URL_TEMPLATE);
    assert.equal(statusAfterKeyReset.maskedApiKey, null);
    assert.equal(statusAfterKeyReset.initialized, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("环境变量覆盖本地 Key，状态支持脱敏与完整 Key", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "transx-env-"));
  const store = new ConfigStore(directory);
  try {
    await store.setApiKey("local-secret-key");
    const status = await store.status({
      DLX_API_KEY: "environment-secret-key",
    });
    assert.equal(status.keySource, "environment");
    assert.equal(status.urlTemplate, DLX_URL_TEMPLATE);
    assert.equal(status.maskedApiKey, maskApiKey("environment-secret-key"));
    assert.ok(!JSON.stringify(status).includes("environment-secret-key"));

    const revealedStatus = await store.statusWithApiKey({
      DLX_API_KEY: "environment-secret-key",
    });
    assert.equal(revealedStatus.apiKey, "environment-secret-key");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
