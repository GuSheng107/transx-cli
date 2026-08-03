---
name: transx-translate
description: "Translate text or supported local files through DLX with the installed TransX CLI. Use for inline text, stdin, txt, md, csv, log, docx, xlsx, pptx, or pdf translation."
---

# TransX CLI

Use only `transx`. Add `--json`.

```text
transx translate "Hello world" --to ZH --source auto --json
transx translate --file ./paper.pdf --to ZH --source auto --json
```

Use `auto` unless the source language is specified. Infer the target language when clear.

Direct text is limited to 1500 characters. Files are limited to 20MB, 100000 translatable characters, and 500 requests.

File translation writes `<name>_<TARGET>.<ext>` beside the source. PDF writes DOCX. Report `output_file`; return `data` only when `fallback` is true. Use `--output` only when the user provides a path.

Run `transx init` when configuration is missing. Get the DLX API Key from https://connect.linux.do/. Translation history is stored in `~/.transx/history/`.

Never expose the API key. Send only requested content to the service.

To switch modes, read `assets/SKILL.original.md`, run `node <skill-dir>/scripts/configure-skill.mjs reset`, and follow the restored setup. Do not delete scripts or uninstall the CLI.
