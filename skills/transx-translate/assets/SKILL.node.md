---
name: transx-translate
description: "Translate plain text by running the bundled Node.js script against api.deeplx.org. Use whenever an AI agent needs direct DeepLX text translation through the user's configured Node.js workflow, including stdin, language selection, timeout control, and JSON output."
---

# Translate with the bundled Node.js script

Use only `scripts/translate.mjs` for translation. Do not present alternative execution methods unless the user explicitly asks to reconfigure this skill.

The script records successful translations in the same shared `~/.transx/history/` format used by TransX CLI.

## Workflow

1. Resolve `scripts/translate.mjs` relative to this `SKILL.md`.
2. Infer the target language from the request. Ask only if it is genuinely ambiguous.
3. Use `auto` for the source language unless the user specifies it.
4. Pass long or shell-sensitive content through stdin.
5. Always add `--json`, parse the returned JSON, and return the translated text.

```text
node <skill-dir>/scripts/translate.mjs translate "Hello world" --to ZH --source auto --json
```

If configuration is missing, run `node <skill-dir>/scripts/translate.mjs init` in an interactive terminal.

Do not expose the API key. Send only content the user asked to translate. Translation content is sent to `api.deeplx.org`.

If the user explicitly asks to switch modes, read the original backup at `assets/SKILL.original.md`, run `node <skill-dir>/scripts/configure-skill.mjs reset` to restore it, then follow that original setup. Do not load the backup during normal translation.

Mode switching changes only `SKILL.md` and the saved preference. Never delete bundled scripts or uninstall an existing TransX CLI.
