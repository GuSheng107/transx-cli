#!/usr/bin/env python3
"""Persist the TransX workflow and replace SKILL.md with its focused version."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import sys
import tempfile


SKILL_ROOT = Path(__file__).resolve().parent.parent
ASSETS = SKILL_ROOT / "assets"
PREFERENCE = Path.home() / ".transx" / "skill-preference.json"


def write_json_atomic(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        if os.name != "nt":
            os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def replace_skill(template_name: str) -> None:
    source = ASSETS / template_name
    target = SKILL_ROOT / "SKILL.md"
    temporary = target.with_name(f".{target.name}.tmp")
    shutil.copyfile(source, temporary)
    os.replace(temporary, target)


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"cli", "script", "reset"}:
        print("usage: configure_skill.py <cli|script|reset>", file=sys.stderr)
        return 2

    mode = sys.argv[1]
    if mode == "reset":
        PREFERENCE.unlink(missing_ok=True)
        replace_skill("SKILL.original.md")
        print(json.dumps({"ok": True, "configured": False}, ensure_ascii=False))
        return 0

    runtime = None if mode == "cli" else "python"
    write_json_atomic(
        PREFERENCE,
        {"version": 1, "mode": mode, "runtime": runtime},
    )
    replace_skill("SKILL.cli.md" if mode == "cli" else "SKILL.python.md")
    print(json.dumps({"ok": True, "mode": mode, "runtime": runtime}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
