---
name: transx-translate
description: "Translate plain text with the installed TransX CLI and api.deeplx.org. Use whenever an AI agent needs DeepLX text translation through the user's configured transx command, including stdin, language selection, timeout control, and structured JSON output."
---

# Translate with TransX CLI

Use only the configured `transx` command for translation. Do not present alternative execution methods unless the user explicitly asks to reconfigure this skill.

Successful translations are recorded in the shared `~/.transx/history/` store.

## Workflow

1. Infer the target language from the request. Ask only if it is genuinely ambiguous.
2. Use `auto` for the source language unless the user specifies it.
3. Pass long or shell-sensitive content through stdin.
4. Always add `--json` and parse the returned JSON.
5. Return the translated text, preserving the requested formatting and without exposing operational JSON unless useful.

```text
transx translate "Hello world" --to ZH --source auto --json
```

If configuration is missing, run `transx init` in an interactive terminal. If the command is missing, reinstall it with `npx @gushengcode/transx-cli@latest install` after verifying Node.js greater than 22.

Do not expose the API key. Send only content the user asked to translate. Translation content is sent to the configured DeepLX-compatible service.

If the user explicitly asks to switch modes, read the original backup at `assets/SKILL.original.md`, run `node <skill-dir>/scripts/configure-skill.mjs reset` to restore it, then follow that original setup. Do not load the backup during normal translation.

Mode switching changes only `SKILL.md` and the saved preference. Never uninstall TransX CLI or delete bundled scripts.
