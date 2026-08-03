---
name: transx-translate
description: "Translate text or supported local files through DLX with the bundled Python script. Use for inline text, stdin, txt, md, csv, log, docx, xlsx, pptx, or pdf translation."
---

# TransX Python script

Use only `scripts/translate.py`. Add `--json`.

```text
python <skill-dir>/scripts/translate.py translate "Hello world" --to ZH --source auto --json
python <skill-dir>/scripts/translate.py translate --file ./paper.pdf --to ZH --source auto --json
```

Install the fixed PDF dependency when it is missing:

```text
python -m pip install -r "<skill-dir>/requirements.txt"
```

Direct text is limited to 1500 characters. Files are limited to 20MB, 100000 translatable characters, and 500 requests.

File translation writes `<name>_<TARGET>.<ext>` beside the source. PDF writes DOCX. Report `output_file`; return `data` only when `fallback` is true. Use `--output` only when the user provides a path.

Run `python <skill-dir>/scripts/translate.py init` when configuration is missing. Get the DLX API Key from https://connect.linux.do/. History is stored in `~/.transx/history/`.

Never expose the API key. Send only requested content to the service.

To switch modes, read `assets/SKILL.original.md`, run `python <skill-dir>/scripts/configure_skill.py reset`, and follow the restored setup. Do not delete scripts or uninstall the CLI.
