---
name: transx-translate
description: "Translate plain text through the DeepLX-compatible api.deeplx.org service. Use when an AI agent needs text translation through one locally selected workflow: the recommended bundled Python script, the bundled Node.js script, or an installed TransX CLI. On first use, inspect the runtime environment, ask the user to choose once, configure the API key, persist the choice, and rewrite this skill to keep only the selected workflow."
---

# TransX Translate

## First-use setup

Resolve this skill directory from the current `SKILL.md`. Never print, log, or put an API key in a command argument.

1. Detect Python 3, Node.js, `npx`, and `transx`, including the Node.js version.
2. Read `~/.transx/skill-preference.json` if it exists. If it contains a valid saved choice, run the matching configurator without asking again, re-read the replaced `SKILL.md`, and continue the translation.
3. If neither Python 3 nor Node.js is available, recommend installing Python 3. After it is installed, configure the Python script workflow directly.
4. Otherwise report the detected environment and ask the user to choose once among:
   - Python script — recommended; requires Python 3.
   - Node.js script — requires Node.js 18 or newer.
   - TransX CLI — requires Node.js greater than 22 and installs the CLI package.
5. Do not make a second runtime-choice prompt after the user selects one of the three options.

Both script workflows write the same `~/.transx/history/` format as TransX CLI. All three workflows share one translation history.

## Configure Python script

1. If Python 3 is unavailable, tell the user to install it and resume afterward.
2. Run `python <skill-dir>/scripts/translate.py init` in an interactive terminal.
3. Run `python <skill-dir>/scripts/configure_skill.py script`.
4. Re-read the replaced `SKILL.md` and complete the current translation.

## Configure Node.js script

1. If Node.js 18 or newer is unavailable, tell the user to install it and resume afterward.
2. Run `node <skill-dir>/scripts/translate.mjs init` in an interactive terminal.
3. Run `node <skill-dir>/scripts/configure-skill.mjs script`.
4. Re-read the replaced `SKILL.md` and complete the current translation.

## Configure TransX CLI

1. Require Node.js greater than 22 and `npx`. If either requirement is missing, tell the user to install or upgrade Node.js and resume afterward.
2. If `transx` is unavailable, install it with `npx @gushengcode/transx-cli@latest install`.
3. Run `transx init` in an interactive terminal.
4. Run `node <skill-dir>/scripts/configure-skill.mjs cli`.
5. Re-read the replaced `SKILL.md` and complete the current translation.

The init commands store credentials in `~/.transx/credentials.json`. `DEEPLX_API_KEY` overrides that file.

Changing modes only replaces the local `SKILL.md` and updates `~/.transx/skill-preference.json`. Never delete bundled scripts or uninstall an existing TransX CLI during configuration or mode switching.

## Safety

- Send only content the user asked to translate.
- Explain that translation content is sent to the configured DeepLX-compatible service when this matters.
- Do not claim affiliation with DeepL SE, DeepLX, or the service operator.
