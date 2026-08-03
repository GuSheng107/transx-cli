# TransX CLI — DeepLX 特供版

一个把 DeepLX 翻译塞进命令行的工具，写给脚本和 AI Agent 用。

> 感谢 [LINUX DO](https://linux.do/) 社区，没有始皇的福利就没有这个CLI

文档站：https://gusheng107.github.io/transx-cli/

## 写在最前

**非官方项目。** TransX CLI 默认连接 `api.deeplx.org`，但 API Key 需要用户自己去 linux.do 的 connect 频道获取，本项目不附带密钥或翻译服务，与 DeepL SE 及任何 DeepLX/DLX 服务运营者均无隶属、授权或背书关系。请确保你有权使用所配置的服务。

## 平台

- Windows 10/11（PowerShell / CMD / Windows Terminal）
- macOS（Apple Silicon 与 Intel，zsh / bash）
- Linux（x64 / arm64，bash / zsh）

需要 Node.js > 22。

## 安装

```bash
npx transx-cli@latest install
```

这会把 `transx` 装到用户目录，并把启动入口加进 PATH：

```text
Windows：    %LOCALAPPDATA%\.transx\bin\transx.cmd
macOS/Linux：~/.transx/bin/transx
配置目录：    ~/.transx/
```

重新打开终端后，直接运行 `transx` 进入交互界面，或查看完整帮助：

```bash
transx help
```

## 配置 API Key

URL 已经内置指向 `api.deeplx.org`，你只需要提供自己的 API Key：

```bash
transx init
```

Key 是隐藏输入的，保存在 `~/.transx/credentials.json`，源码、npm 包和日志里都不会出现你的 Key。

非交互环境（比如 CI）可以从 stdin 传：

```bash
printf '%s' "$DEEPLX_API_KEY" | transx init --key-stdin
```

也可以临时用环境变量 `DEEPLX_API_KEY` 覆盖本地配置，不写盘。

## 翻译

给 AI Agent 调用时建议始终带 `--json`：

```bash
transx translate "Hello world" --to ZH --json
```

从 stdin 读：

```bash
echo "Hello world" | transx translate --to ZH --json
```

翻译 HTML / XML 片段：

```bash
transx translate '<p>Hello</p>' --to ZH --format html --json
```

完整参数：

```text
-t, --to <lang>              目标语言（必填）
-s, --source <lang>          源语言，默认 auto
    --format <plain|html|xml> 内容格式，默认 plain
    --json                   输出 AI 友好的 JSON
    --timeout <seconds>      本次请求超时
```

成功输出：

```json
{"ok":true,"data":"你好，世界","source_lang":"auto","target_lang":"ZH","provider":"deeplx-compatible"}
```

失败走 stderr，非零退出码，方便脚本捕获：

```json
{"ok":false,"error":{"code":"CONFIG_NOT_INITIALIZED","message":"缺少 DeepLX API Key，请先运行 transx init"}}
```

查看支持的语言代码（不需要联网或初始化）：

```bash
transx languages
transx languages --json
```

经实测 `api.deeplx.org` 支持 31 个目标语言，`EN` / `PT` 为直接可用代码；`EN-GB`、`EN-US`、`ES-419`、`HE`、`PT-BR`、`PT-PT`、`VI` 不可用。中文用 `ZH`（默认简体）和 `ZH-HANT`（繁体）。源语言支持 `AUTO` 及上述全部代码。

## 翻译历史

每条成功的翻译都会落到本地历史，不记录 URL 和 API Key。历史按中国时间拆分到 `YYYY-MM-DD.json`，时间格式 `YYYY-MM-DD HH:mm:ss.SSS`。

```bash
transx history                         # 最近 20 条
transx history --limit 50 --offset 100
transx history --from "2026-08-01" --to "2026-08-03"
transx history --since 7d --json
```

搜索原文和译文（任一包含关键词就返回）：

```bash
transx history search "环境审查" --json
```

查看文件状态、清理：

```bash
transx history status
transx history clear --oldest 100
transx history clear --keep 1000
transx history clear --older-than 30d --yes
transx history clear --from "2026-07-01" --to "2026-07-31" --yes
transx history clear --all --yes
```

历史目录 `~/.transx/history/`，含 `index.json` 和按日期拆分的文件。不限制条数；当最早记录超过 30 天或文件总量超过 100 MB 时，每天最多提醒一次，不会自动删你的记录。

## 配置

```bash
transx config                  # 查看 URL 模板和完整 API Key
transx config set-key          # 重新输入 Key（隐藏）
transx config set-key --stdin  # 从 stdin 读 Key
transx config reset key        # 删掉 Key
transx config reset all        # 重置全部
```

`transx config` 会显示完整 API Key，但不会显示拼接后的请求 URL。

## 版本与更新

```bash
transx version          # 当前版本
transx version --check  # 对比 npm 上的最新版
transx update           # 拉最新版并重新安装
```

`update` 走 npm Registry 拉最新版，原子替换启动入口；旧版本目录会保留，方便排查或回退。

## 隐私和安全

- 待翻译内容会发到你配置的 DeepLX-compatible 服务（默认 `api.deeplx.org`），别拿它翻译密码、令牌或不想离开本机的东西。
- API Key 存在 `~/.transx/credentials.json`，POSIX 系统文件权限 0600。
- 不收集任何遥测。
- URL 与 Key 不会编译进程序。

## 开发

```bash
npm install
npm run check    # 类型检查
npm run build    # 编译到 dist/
npm pack --dry-run
```

要求 Node.js > 22。每次提交会在 Windows、macOS、Linux 三系统跑类型检查、构建和打包检查。

## 许可

[MIT License](./LICENSE)。

## 友情链接

- [LINUX DO](https://linux.do/)
