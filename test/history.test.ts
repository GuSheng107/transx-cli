import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { HistoryStore } from "../src/history.js";

interface DailyHistoryFixture {
  records: Array<{ createdAt: string; input: string; output: string }>;
}

function isDailyHistoryFixture(value: unknown): value is DailyHistoryFixture {
  if (typeof value !== "object" || value === null || !("records" in value)) return false;
  const records = value.records;
  return Array.isArray(records) && records.every((record: unknown) => (
    typeof record === "object"
    && record !== null
    && "createdAt" in record
    && typeof record.createdAt === "string"
    && "input" in record
    && typeof record.input === "string"
    && "output" in record
    && typeof record.output === "string"
  ));
}

async function withHistoryStore(
  run: (store: HistoryStore, directory: string) => Promise<void>,
  options: ConstructorParameters<typeof HistoryStore>[1] = {},
): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "transx-history-"));
  try {
    await run(new HistoryStore(directory, options), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("历史按中国时间日期写入标准 JSON 文件且不带时区标记", async () => {
  await withHistoryStore(async (store, directory) => {
    await store.append({
      createdAt: "2026-08-01T16:30:00.000Z",
      sourceLang: "EN",
      targetLang: "ZH",
      format: "plain",
      input: "Hello",
      output: "你好",
    });
    const dailyPath = path.join(directory, "history", "2026-08-02.json");
    const daily: unknown = JSON.parse(await readFile(dailyPath, "utf8"));
    assert.ok(isDailyHistoryFixture(daily));
    assert.equal(daily.records[0]?.createdAt, "2026-08-02 00:30:00.000");
    assert.doesNotMatch(daily.records[0]?.createdAt ?? "", /Z|\+08:00|CST/);
    assert.equal(daily.records[0]?.input, "Hello");
    assert.equal(daily.records[0]?.output, "你好");
  });
});

test("历史支持条数、偏移和中国时间范围查询", async () => {
  await withHistoryStore(async (store) => {
    for (const [createdAt, input, output] of [
      ["2026-08-01T01:00:00+08:00", "one", "一"],
      ["2026-08-02T01:00:00+08:00", "two", "二"],
      ["2026-08-03T01:00:00+08:00", "three", "三"],
    ] as const) {
      await store.append({ createdAt, sourceLang: "EN", targetLang: "ZH", format: "plain", input, output });
    }
    const page = await store.query({ limit: 1, offset: 1 });
    assert.equal(page.total, 3);
    assert.equal(page.records[0]?.input, "two");

    const range = await store.query({
      from: "2026-08-02 00:00:00.000",
      to: "2026-08-03 00:00:00.000",
      limit: 20,
    });
    assert.deepEqual(range.records.map((record) => record.input), ["two"]);
  });
});

test("关键词同时搜索原文和译文并返回多条记录", async () => {
  await withHistoryStore(async (store) => {
    await store.append({
      createdAt: "2026-08-01T01:00:00+08:00",
      sourceLang: "EN",
      targetLang: "ZH",
      format: "plain",
      input: "Environmental review is pending",
      output: "环境审查尚未完成",
    });
    await store.append({
      createdAt: "2026-08-02T01:00:00+08:00",
      sourceLang: "ZH",
      targetLang: "EN",
      format: "plain",
      input: "请完成环境审查",
      output: "Please complete the review",
    });
    await store.append({
      createdAt: "2026-08-03T01:00:00+08:00",
      sourceLang: "EN",
      targetLang: "ZH",
      format: "plain",
      input: "Unrelated text",
      output: "无关内容",
    });
    const chinese = await store.query({ keyword: "环境审查", limit: 20 });
    assert.equal(chinese.total, 2);
    const english = await store.query({ keyword: "REVIEW", limit: 20 });
    assert.equal(english.total, 2);
  });
});

test("文件历史只保存路径和文件名并支持搜索与清理", async () => {
  await withHistoryStore(async (store) => {
    await store.append({
      createdAt: "2026-08-01T01:00:00+08:00",
      sourceLang: "EN",
      targetLang: "ZH",
      format: "file",
      sourceFilePath: "C:\\papers\\research-paper.docx",
      sourceFileName: "research-paper.docx",
      outputFilePath: "C:\\papers\\research-paper_ZH.docx",
      outputFileName: "research-paper_ZH.docx",
    });
    const sourceMatch = await store.query({ keyword: "RESEARCH-PAPER", limit: 20 });
    const outputMatch = await store.query({ keyword: "_zh.docx", limit: 20 });
    assert.equal(sourceMatch.total, 1);
    assert.equal(outputMatch.total, 1);
    const record = sourceMatch.records[0];
    assert.equal(record?.format, "file");
    if (record?.format === "file") {
      assert.equal(record.sourceFileName, "research-paper.docx");
      assert.equal(record.outputFileName, "research-paper_ZH.docx");
      assert.equal("input" in record, false);
      assert.equal("output" in record, false);
    }
    assert.equal(await store.clear({ kind: "all" }), 1);
    assert.equal((await store.query({ limit: 20 })).total, 0);
  });
});

test("历史可按最旧条数、保留条数和时间范围清理", async () => {
  await withHistoryStore(async (store) => {
    for (let day = 1; day <= 5; day += 1) {
      await store.append({
        createdAt: `2026-08-0${day}T01:00:00+08:00`,
        sourceLang: "EN",
        targetLang: "ZH",
        format: "plain",
        input: `record-${day}`,
        output: `记录-${day}`,
      });
    }
    assert.equal(await store.clear({ kind: "oldest", count: 1 }), 1);
    assert.equal((await store.query({ limit: 20 })).total, 4);
    assert.equal(
      await store.clear({
        kind: "range",
        from: "2026-08-03 00:00:00.000",
        to: "2026-08-03 23:59:59.999",
      }),
      1,
    );
    assert.equal(await store.clear({ kind: "keep", count: 1 }), 2);
    const remaining = await store.query({ limit: 20 });
    assert.deepEqual(remaining.records.map((record) => record.input), ["record-5"]);
  });
});

test("超过配置的天数或容量阈值时只生成提醒状态", async () => {
  const now = new Date("2026-08-31T00:00:00.000Z");
  await withHistoryStore(
    async (store) => {
      const warning = await store.append({
        createdAt: "2026-07-01T00:00:00.000Z",
        sourceLang: "EN",
        targetLang: "ZH",
        format: "plain",
        input: "large history",
        output: "较大的历史",
      });
      assert.match(warning ?? "", /超过 30 天/);
      assert.match(warning ?? "", /超过 0 MB/);
      const status = await store.status();
      assert.equal(status.ageWarning, true);
      assert.equal(status.sizeWarning, true);
      assert.equal(status.totalRecords, 1);
    },
    { now: () => now, maxAgeDays: 30, maxBytes: 1 },
  );
});

test("并发写入历史不会丢失记录", async () => {
  await withHistoryStore(async (store) => {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        store.append({
          createdAt: `2026-08-03T10:00:${String(index).padStart(2, "0")}+08:00`,
          sourceLang: "EN",
          targetLang: "ZH",
          format: "plain",
          input: `input-${index}`,
          output: `output-${index}`,
        }),
      ),
    );
    assert.equal((await store.query({ limit: 20 })).total, 10);
  });
});
