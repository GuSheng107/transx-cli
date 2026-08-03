import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CONFIG_VERSION,
  DEFAULT_TARGET_LANGUAGE,
  DEFAULT_TIMEOUT_MS,
  ENV_API_KEY,
  ENV_URL_TEMPLATE,
  URL_KEY_PLACEHOLDER,
} from "./constants.js";
import { TransxError } from "./errors.js";
import { getConfigRoot } from "./paths.js";

interface StoredConfig {
  version: number;
  urlTemplate: string;
  defaultTarget: string;
  timeoutMs: number;
}

interface StoredCredentials {
  version: number;
  apiKey: string;
}

export interface ResolvedConfig {
  urlTemplate: string;
  apiKey: string;
  defaultTarget: string;
  timeoutMs: number;
}

export interface ConfigStatus {
  configDirectory: string;
  urlTemplate: string | null;
  maskedApiKey: string | null;
  initialized: boolean;
  urlSource: "environment" | "local" | null;
  keySource: "environment" | "local" | null;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new TransxError("CONFIG_INVALID", `无法读取本地配置：${filePath}`, 3, { cause: error });
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, filePath);
}

export function validateUrlTemplate(value: string): string {
  const normalized = value.trim();
  if (!normalized.includes(URL_KEY_PLACEHOLDER)) {
    throw new TransxError(
      "CONFIG_INVALID",
      `URL 模板必须包含 ${URL_KEY_PLACEHOLDER}，例如 https://example.invalid/${URL_KEY_PLACEHOLDER}/translate`,
      3,
    );
  }
  try {
    const parsed = new URL(normalized.replaceAll(URL_KEY_PLACEHOLDER, "sample-key"));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
  } catch (error) {
    throw new TransxError("CONFIG_INVALID", "URL 模板必须是有效的 HTTP 或 HTTPS 地址", 3, {
      cause: error,
    });
  }
  return normalized;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "*".repeat(apiKey.length);
  }
  return `${apiKey.slice(0, 4)}${"*".repeat(Math.min(8, apiKey.length - 8))}${apiKey.slice(-4)}`;
}

export class ConfigStore {
  readonly directory: string;
  readonly configPath: string;
  readonly credentialsPath: string;

  constructor(directory = getConfigRoot()) {
    this.directory = directory;
    this.configPath = path.join(directory, "config.json");
    this.credentialsPath = path.join(directory, "credentials.json");
  }

  async setUrlTemplate(urlTemplate: string): Promise<void> {
    const existing = await readJson<StoredConfig>(this.configPath);
    await writeJsonAtomic(this.configPath, {
      version: CONFIG_VERSION,
      urlTemplate: validateUrlTemplate(urlTemplate),
      defaultTarget: existing?.defaultTarget || DEFAULT_TARGET_LANGUAGE,
      timeoutMs: existing?.timeoutMs || DEFAULT_TIMEOUT_MS,
    } satisfies StoredConfig);
  }

  async setApiKey(apiKey: string): Promise<void> {
    const normalized = apiKey.trim();
    if (!normalized) {
      throw new TransxError("CONFIG_INVALID", "API Key 不能为空", 3);
    }
    await writeJsonAtomic(this.credentialsPath, {
      version: CONFIG_VERSION,
      apiKey: normalized,
    } satisfies StoredCredentials);
  }

  async resetUrl(): Promise<void> {
    await rm(this.configPath, { force: true });
  }

  async resetKey(): Promise<void> {
    await rm(this.credentialsPath, { force: true });
  }

  async resetAll(): Promise<void> {
    await Promise.all([this.resetUrl(), this.resetKey()]);
  }

  async resolve(env: NodeJS.ProcessEnv = process.env): Promise<ResolvedConfig> {
    const storedConfig = await readJson<StoredConfig>(this.configPath);
    const storedCredentials = await readJson<StoredCredentials>(this.credentialsPath);
    const urlTemplate = env[ENV_URL_TEMPLATE]?.trim() || storedConfig?.urlTemplate;
    const apiKey = env[ENV_API_KEY]?.trim() || storedCredentials?.apiKey;

    if (!urlTemplate || !apiKey) {
      throw new TransxError(
        "CONFIG_NOT_INITIALIZED",
        "缺少 DeepLX URL 或 API Key，请先运行 transx init",
        3,
      );
    }

    return {
      urlTemplate: validateUrlTemplate(urlTemplate),
      apiKey,
      defaultTarget: storedConfig?.defaultTarget || DEFAULT_TARGET_LANGUAGE,
      timeoutMs: storedConfig?.timeoutMs || DEFAULT_TIMEOUT_MS,
    };
  }

  async status(env: NodeJS.ProcessEnv = process.env): Promise<ConfigStatus> {
    const storedConfig = await readJson<StoredConfig>(this.configPath);
    const storedCredentials = await readJson<StoredCredentials>(this.credentialsPath);
    const envUrl = env[ENV_URL_TEMPLATE]?.trim();
    const envKey = env[ENV_API_KEY]?.trim();
    const urlTemplate = envUrl || storedConfig?.urlTemplate || null;
    const apiKey = envKey || storedCredentials?.apiKey || null;
    return {
      configDirectory: this.directory,
      urlTemplate,
      maskedApiKey: apiKey ? maskApiKey(apiKey) : null,
      initialized: Boolean(urlTemplate && apiKey),
      urlSource: envUrl ? "environment" : storedConfig?.urlTemplate ? "local" : null,
      keySource: envKey ? "environment" : storedCredentials?.apiKey ? "local" : null,
    };
  }
}
