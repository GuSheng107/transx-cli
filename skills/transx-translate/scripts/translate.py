#!/usr/bin/env python3
"""Standalone DeepLX translator using only the Python standard library."""

from __future__ import annotations

import argparse
import getpass
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from typing import NoReturn
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from history import append_history


CONFIG_PATH = Path.home() / ".transx" / "credentials.json"
ENDPOINT = "https://api.deeplx.org/{key}/translate"
RETRIES = 2


class TranslationError(Exception):
    def __init__(self, code: str, message: str, exit_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.exit_code = exit_code


def fail(code: str, message: str, exit_code: int) -> NoReturn:
    raise TranslationError(code, message, exit_code)


def write_credentials(api_key: str) -> None:
    normalized = api_key.strip()
    if not normalized:
        fail("CONFIG_INVALID", "API Key 不能为空", 3)
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".credentials.", dir=CONFIG_PATH.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump({"version": 1, "apiKey": normalized}, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        if os.name != "nt":
            os.chmod(temporary, 0o600)
        os.replace(temporary, CONFIG_PATH)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def resolve_api_key() -> str:
    environment_key = os.environ.get("DEEPLX_API_KEY", "").strip()
    if environment_key:
        return environment_key
    try:
        stored = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail("CONFIG_NOT_INITIALIZED", "缺少 DeepLX API Key，请先运行 translate.py init", 3)
    except (OSError, json.JSONDecodeError) as error:
        fail("CONFIG_INVALID", f"无法读取本地配置：{error}", 3)
    api_key = stored.get("apiKey") if isinstance(stored, dict) else None
    if not isinstance(api_key, str) or not api_key.strip():
        fail("CONFIG_INVALID", "本地配置缺少有效 API Key", 3)
    return api_key.strip()


def request_translation(
    text: str,
    target: str,
    source: str,
    timeout: float,
) -> dict[str, object]:
    if not text.strip():
        fail("INVALID_ARGUMENT", "待翻译文本不能为空", 2)
    payload = {
        "text": text,
        "source_lang": source,
        "target_lang": target.upper(),
    }
    endpoint = ENDPOINT.format(key=quote(resolve_api_key(), safe=""))
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    for attempt in range(RETRIES + 1):
        request = Request(
            endpoint,
            data=encoded,
            headers={"content-type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                raw = response.read().decode("utf-8")
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                fail("API_RESPONSE_INVALID", "DeepLX 返回的不是有效 JSON", 6)
            if not isinstance(body, dict):
                fail("API_RESPONSE_INVALID", "DeepLX 返回的 JSON 结构无效", 6)
            if body.get("code") not in (None, 200):
                fail("API_HTTP_ERROR", str(body.get("message") or "DeepLX 返回业务错误"), 5)
            if not isinstance(body.get("data"), str):
                fail("API_RESPONSE_INVALID", "DeepLX 响应缺少字符串字段 data", 6)
            return {
                "ok": True,
                "data": body["data"],
                "source_lang": source,
                "target_lang": target.upper(),
                "provider": "deeplx-compatible",
            }
        except HTTPError as error:
            if attempt < RETRIES and (error.code == 429 or error.code >= 500):
                time.sleep(0.3 * (2**attempt))
                continue
            fail("API_HTTP_ERROR", f"DeepLX 请求失败，HTTP {error.code}", 5)
        except (URLError, TimeoutError) as error:
            if attempt < RETRIES:
                time.sleep(0.3 * (2**attempt))
                continue
            fail("NETWORK_ERROR", f"无法连接 DeepLX 服务：{error}", 4)
    fail("NETWORK_ERROR", "无法连接 DeepLX 服务", 4)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Direct api.deeplx.org translation client")
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="save the DeepLX API key")
    init.add_argument("--key-stdin", action="store_true", help="read API key from stdin")
    translate = commands.add_parser("translate", help="translate text")
    translate.add_argument("text", nargs="*", help="text; read stdin when omitted")
    translate.add_argument("--to", required=True, help="target language code")
    translate.add_argument("--source", default="auto", help="source language code")
    translate.add_argument("--timeout", type=float, default=20.0, help="timeout in seconds")
    translate.add_argument("--json", action="store_true", help="emit one-line JSON")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "init":
        key = sys.stdin.read().rstrip("\r\n") if args.key_stdin else getpass.getpass("DeepLX API Key：")
        write_credentials(key)
        print(json.dumps({"ok": True, "config": str(CONFIG_PATH)}, ensure_ascii=False))
        return 0

    if args.timeout <= 0:
        fail("INVALID_ARGUMENT", "--timeout 必须是正数秒", 2)
    text = " ".join(args.text) if args.text else ("" if sys.stdin.isatty() else sys.stdin.read())
    result = request_translation(text, args.to, args.source, args.timeout)
    try:
        append_history(args.source, args.to.upper(), text, str(result["data"]))
    except Exception as error:  # Translation still succeeded; match CLI's non-fatal history behavior.
        print(f"历史记录写入失败：{error}", file=sys.stderr)
    print(json.dumps(result, ensure_ascii=False) if args.json else result["data"])
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except TranslationError as error:
        payload = {"ok": False, "error": {"code": error.code, "message": str(error)}}
        print(json.dumps(payload, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(error.exit_code)
