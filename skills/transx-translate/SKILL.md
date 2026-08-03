---
name: transx-translate
description: "Translate text or supported local files through DLX using one saved workflow: Python script, Node.js script, or TransX CLI. On first use, detect runtimes, ask once, install the selected workflow dependencies, configure the API key, and replace this file with the selected workflow."
---

# TransX Translate

## First use

Resolve `<skill-dir>` from this file. Never expose the API key.
Get the DLX API Key from https://connect.linux.do/.

1. Detect Python 3, Node.js, `npx`, and `transx`; record the Node.js version.
2. Reuse a valid choice from `~/.transx/skill-preference.json`.
3. If neither Python nor Node.js exists, ask the user to install Python 3 and then select Python.
4. Otherwise ask once: Python script (recommended), Node.js script, or TransX CLI.

### Python script

```text
python -m pip install -r "<skill-dir>/requirements.txt"
python <skill-dir>/scripts/translate.py init
python <skill-dir>/scripts/configure_skill.py script
```

### Node.js script

Requires Node.js 18 or newer.

```text
npm ci --omit=dev --prefix "<skill-dir>"
node <skill-dir>/scripts/translate.mjs init
node <skill-dir>/scripts/configure-skill.mjs script
```

### TransX CLI

Requires Node.js greater than 22 and `npx`.

```text
npx @gushengcode/transx-cli@latest install
transx init
node <skill-dir>/scripts/configure-skill.mjs cli
```

Re-read the replaced `SKILL.md` and continue the translation.

All modes use `~/.transx/credentials.json` and `~/.transx/history/`. Changing modes only replaces `SKILL.md` and the preference file.
