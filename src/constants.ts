export const APP_NAME = "transx";
export const PACKAGE_NAME = "transx-cli";
export const CONFIG_VERSION = 1;
export const DEFAULT_SOURCE_LANGUAGE = "auto";
export const DEFAULT_TARGET_LANGUAGE = "ZH";
export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_MAX_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 300;
export const URL_KEY_PLACEHOLDER = "{key}";
// deeplx.org 特供版：URL 模板固定，用户只需提供 API Key。
export const DEEPLX_URL_TEMPLATE = "https://api.deeplx.org/{key}/translate";
export const HISTORY_MAX_AGE_DAYS = 30;
export const HISTORY_MAX_BYTES = 100 * 1024 * 1024;
export const HISTORY_DEFAULT_LIMIT = 20;
export const HISTORY_WARNING_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const HISTORY_LOCK_TIMEOUT_MS = 5_000;
export const HISTORY_STALE_LOCK_MS = 30_000;

export const ENV_API_KEY = "DEEPLX_API_KEY";
