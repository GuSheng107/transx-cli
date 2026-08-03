---
name: transx-translate
description: "Translate plain text through the DeepLX-compatible api.deeplx.org service. Use when an AI agent needs text translation through one locally selected workflow: the recommended bundled Python script, the bundled Node.js script, or an installed TransX CLI. On first use, inspect the runtime environment, ask the user to choose once, configure the API key, persist the choice, and rewrite this skill to keep only the selected workflow."
---

# TransX Translate

## First-use setup

Resolve this skill directory from the current `SKILL.md`. Never expose the API key.

1. Detect Python 3, Node.js, `npx`, and `transx`, including the Node.js version.
2. Honor a valid choice in `~/.transx/skill-preference.json` without asking again.
3. If neither Python 3 nor Node.js exists, recommend installing Python 3, then configure the Python script workflow.
4. Otherwise report availability and ask once: Python script (recommended), Node.js script, or TransX CLI.

Python uses `translate.py init` and `configure_skill.py script`. Node.js uses `translate.mjs init` and `configure-skill.mjs script`. CLI requires Node.js greater than 22, installs with `npx @gushengcode/transx-cli@latest install`, initializes with `transx init`, and uses `configure-skill.mjs cli`.

Both scripts write the CLI-compatible shared history under `~/.transx/history/`. Re-read the replaced `SKILL.md` before completing the current translation.

Changing modes only replaces `SKILL.md` and the preference file. Keep all bundled scripts and any installed TransX CLI.
