# TransX CLI — DeepLX 特供版

> **非官方项目。** TransX CLI 仅连接用户自行提供的 DeepLX-compatible URL 和 API Key，不附带公共接口、密钥或翻译服务，与 DeepL SE 及任何 DeepLX/DLX 服务运营者均无隶属、授权或背书关系。

TransX 是一个面向脚本和 AI Agent 的文本翻译命令行工具。它只处理文本，不读取文件、不启动服务器，也不包含 MCP。

文档站：[gusheng107.github.io/transx-cli](https://gusheng107.github.io/transx-cli/)

支持平台：

- Windows 10/11（PowerShell、CMD、Windows Terminal）
- macOS（Apple Silicon 与 Intel，zsh/bash）
- Linux（x64/arm64，bash/zsh）

## 安装

要求 **Node.js > 22**。

推荐通过 npm Registry 安装到用户目录：

```bash
npx transx-cli install
```

安装布局参考 Luckin CLI：

```text
Windows 可执行入口：%LOCALAPPDATA%\.transx\bin\transx.cmd
Windows 版本目录：  %LOCALAPPDATA%\.transx\bin\<version>\
macOS/Linux：        ~/.transx/bin/
配置目录：           ~/.transx/
```

安装会将用户级 `bin` 目录加入 PATH。重新打开终端后运行：

```bash
transx help
```

## 初始化

```bash
transx init
```

URL 必须由用户提供，并包含 `{key}` 占位符，例如：

```text
https://your-deeplx.example/{key}/translate
```

API Key 单独隐藏输入。源码、npm 包和日志都不会包含用户的 URL 或 Key。

非交互环境可以使用：

```bash
printf '%s' "$DEEPLX_API_KEY" | transx init \
  --url 'https://your-deeplx.example/{key}/translate' \
  --key-stdin
```

也可用 `DEEPLX_URL_TEMPLATE` 和 `DEEPLX_API_KEY` 临时覆盖本地配置。

## 翻译

面向 AI 调用时推荐始终使用 `--json`：

```bash
transx translate "Hello world" --to ZH --json
```

从 stdin 读取：

```bash
echo "Hello world" | transx translate --to ZH --json
```

HTML/XML：

```bash
transx translate '<p>Hello</p>' --to ZH --format html --json
```

成功输出：

```json
{"ok":true,"data":"你好，世界","source_lang":"auto","target_lang":"ZH","provider":"deeplx-compatible"}
```

失败输出到 stderr，并使用非零退出码：

```json
{"ok":false,"error":{"code":"CONFIG_NOT_INITIALIZED","message":"缺少 DeepLX URL 或 API Key，请先运行 transx init"}}
```

## 配置

```bash
transx config
transx config set-url 'https://your-deeplx.example/{key}/translate'
transx config set-key
transx config reset url
transx config reset key
transx config reset all
```

`transx config` 只显示脱敏 Key，绝不显示拼接后的完整请求 URL。

## 版本与更新

```bash
transx version
transx version --check
transx update
```

`transx update` 通过 npm Registry 获取最新版，并原子更新用户目录中的启动入口。旧版本目录会保留，便于排查或回退。

## 开发

```bash
npm install
npm run check
npm test
npm run build
npm pack --dry-run
```

要求 Node.js > 22。

所有提交均在 Windows、macOS、Linux 三系统上运行类型检查、单元测试、构建和 npm 打包检查。

## 隐私和安全

- 待翻译内容会发送到用户配置的第三方 DeepLX-compatible 服务。
- 请勿翻译密码、访问令牌或不应离开本机的敏感内容。
- URL 与 API Key 不会被编译进程序。
- API Key 保存在 `~/.transx/credentials.json`，POSIX 系统使用仅当前用户可读的文件权限。
- 本项目不收集遥测。
