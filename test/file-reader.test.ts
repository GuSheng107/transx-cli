import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { strToU8, unzipSync, zipSync } from "fflate";

import { FILE_MAX_BYTES, FILE_TOTAL_TEXT_MAX_CHARS, TRANSLATION_TEXT_MAX_CHARS } from "../src/constants.js";
import { prepareFileTranslation, writeTranslatedFile } from "../src/file-document.js";
import { readFileForTranslation } from "../src/file-reader.js";
import { writeSimplePdf } from "./pdf-fixture.js";

async function withTempDirectory(operation: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "transx-file-reader-"));
  try {
    await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("读取 UTF-8、BOM 和 Markdown 散文", async () => {
  await withTempDirectory(async (directory) => {
    const textPath = path.join(directory, "中文 文件.txt");
    await writeFile(textPath, Buffer.from("\uFEFF第一行\r\n第二行", "utf8"));
    assert.equal((await readFileForTranslation(textPath)).text, "第一行\n第二行");

    const markdownPath = path.join(directory, "paper.md");
    await writeFile(markdownPath, "摘要\n\n```ts\nconst secret = 1;\n```\n\n结论", "utf8");
    assert.equal((await readFileForTranslation(markdownPath)).text, "摘要\n结论");
  });
});

test("拒绝无效 UTF-8、目录和超限内容", async () => {
  await withTempDirectory(async (directory) => {
    const invalidPath = path.join(directory, "invalid.txt");
    await writeFile(invalidPath, Buffer.from([0xc3, 0x28]));
    await assert.rejects(readFileForTranslation(invalidPath), /UTF-8/);
    await assert.rejects(readFileForTranslation(directory), /不是文件/);

    const longPath = path.join(directory, "long.txt");
    await writeFile(longPath, "a".repeat(TRANSLATION_TEXT_MAX_CHARS + 1), "utf8");
    assert.equal((await prepareFileTranslation(longPath)).units.length, 2);

    const totalPath = path.join(directory, "total.txt");
    await writeFile(totalPath, "a".repeat(FILE_TOTAL_TEXT_MAX_CHARS + 1), "utf8");
    await assert.rejects(prepareFileTranslation(totalPath), /100000/);

    const requestsPath = path.join(directory, "requests.txt");
    await writeFile(requestsPath, Array.from({ length: 501 }, () => "a").join("\n"), "utf8");
    await assert.rejects(prepareFileTranslation(requestsPath), /500/);

    const largePath = path.join(directory, "large.txt");
    await writeFile(largePath, "", "utf8");
    await truncate(largePath, FILE_MAX_BYTES + 1);
    await assert.rejects(readFileForTranslation(largePath), /压缩或分批/);
  });
});

test("提取 docx、xlsx 和 pptx 文本", async () => {
  await withTempDirectory(async (directory) => {
    const fixtures = [
      {
        name: "sample.docx",
        files: {
          "word/document.xml": strToU8("<w:document><w:p><w:r><w:t>Hello &amp; world</w:t></w:r></w:p></w:document>"),
        },
        expected: "Hello & world",
      },
      {
        name: "sample.xlsx",
        files: {
          "xl/sharedStrings.xml": strToU8("<sst><si><t>Shared text</t></si></sst>"),
          "xl/worksheets/sheet1.xml": strToU8('<worksheet><row><c t="s"><v>0</v></c><c t="inlineStr"><is><t>Inline text</t></is></c></row></worksheet>'),
        },
        expected: "Shared text\nInline text",
      },
      {
        name: "sample.pptx",
        files: {
          "ppt/slides/slide1.xml": strToU8("<p:sld><a:p><a:r><a:t>Slide title</a:t></a:r><a:r><a:rPr lang=\"en-US\"/><a:t>Slide body</a:t></a:r></a:p></p:sld>"),
        },
        expected: "Slide title\nSlide body",
      },
    ];
    for (const fixture of fixtures) {
      const filePath = path.join(directory, fixture.name);
      await writeFile(filePath, zipSync(fixture.files));
      assert.equal((await readFileForTranslation(filePath)).text, fixture.expected);
    }
  });
});

test("生成同格式译文并保留 Office 包内资源", async () => {
  await withTempDirectory(async (directory) => {
    const sourcePath = path.join(directory, "paper.docx");
    const documentXml = [
      "<w:document><w:p>",
      "<w:r><w:rPr><w:b/></w:rPr><w:t>Hello </w:t></w:r>",
      "<w:r><w:rPr><w:b/></w:rPr><w:t>world</w:t></w:r>",
      "</w:p></w:document>",
    ].join("");
    await writeFile(sourcePath, zipSync({
      "word/document.xml": strToU8(documentXml),
      "word/media/image.bin": new Uint8Array([1, 2, 3]),
    }));
    const prepared = await prepareFileTranslation(sourcePath);
    assert.deepEqual(prepared.units.map((unit) => unit.text), ["Hello world"]);
    const written = await writeTranslatedFile(prepared, ["你好世界"], "ZH");
    assert.equal(path.basename(written.outputPath ?? ""), "paper_ZH.docx");
    const files = unzipSync(await readFile(written.outputPath ?? ""));
    const translatedXml = new TextDecoder().decode(files["word/document.xml"]);
    assert.match(translatedXml, /<w:t>你好世界<\/w:t>/);
    assert.equal((translatedXml.match(/<w:b\/>/g) ?? []).length, 2);
    assert.deepEqual(files["word/media/image.bin"], new Uint8Array([1, 2, 3]));

    const existingPath = path.join(directory, "existing.docx");
    await writeFile(existingPath, "keep", "utf8");
    const fallback = await writeTranslatedFile(prepared, ["你好世界"], "ZH", existingPath);
    assert.deepEqual(fallback, { outputPath: null, fallback: true });
    assert.equal(await readFile(existingPath, "utf8"), "keep");
  });
});

test("Markdown 和 CSV 输出保留结构", async () => {
  await withTempDirectory(async (directory) => {
    const markdownPath = path.join(directory, "guide.md");
    await writeFile(markdownPath, "# Read [docs](https://example.com) and `npm test`\n```js\nconst keep = true;\n```\n", "utf8");
    const markdown = await prepareFileTranslation(markdownPath);
    const markdownOutput = new TextDecoder().decode(markdown.render(markdown.units.map((_, index) => `译文${index}`)));
    assert.match(markdownOutput, /https:\/\/example\.com/);
    assert.match(markdownOutput, /`npm test`/);
    assert.match(markdownOutput, /const keep = true/);

    const csvPath = path.join(directory, "data.csv");
    await writeFile(csvPath, 'name,note\r\nAlice,"Hello, ""world"""\r\n', "utf8");
    const csv = await prepareFileTranslation(csvPath);
    const csvOutput = new TextDecoder().decode(csv.render(csv.units.map((_, index) => `值"${index}`)));
    assert.equal(csvOutput, '"值""0","值""1"\r\n"值""2","值""3"\r\n');
  });
});

test("PDF 生成 DOCX 译文", async () => {
  await withTempDirectory(async (directory) => {
    const sourcePath = path.join(directory, "paper.pdf");
    await writeSimplePdf(sourcePath, "Research abstract");
    const prepared = await prepareFileTranslation(sourcePath);
    assert.equal(prepared.outputExtension, ".docx");
    const written = await writeTranslatedFile(prepared, ["研究摘要"], "ZH");
    assert.equal(path.basename(written.outputPath ?? ""), "paper_ZH.docx");
    const files = unzipSync(await readFile(written.outputPath ?? ""));
    assert.match(new TextDecoder().decode(files["word/document.xml"]), /研究摘要/);
  });
});

test("使用 unpdf 提取真实 PDF 文本", async () => {
  await withTempDirectory(async (directory) => {
    const filePath = path.join(directory, "paper.pdf");
    await writeSimplePdf(filePath, "Real PDF translation test");
    assert.match((await readFileForTranslation(filePath)).text, /Real PDF translation test/);
  });
});
