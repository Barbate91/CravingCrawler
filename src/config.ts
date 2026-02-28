import YAML from "yaml";
import { readFile } from "fs/promises";
import path from "path";
import type { Selectors } from "./parse.js";
import type { ApiConfig } from "./fetch-api.js";
import type { BrowserFetchOptions } from "./fetch-browser.js";
import type { EmbeddedJsonConfig } from "./fetch-embedded.js";

/**
 * Top-level config.yml schema.
 */
export type AppConfig = {
  settings: Settings;
  notifications: NotificationConfig;
  sites: Record<string, SiteDef>;
  targets: TargetDef[];
};

export type Settings = {
  interval_minutes: number;
  rate_limit_seconds: number;
  user_agent?: string;
};

export type NotificationConfig = {
  enabled: boolean;
  discord_webhook_url?: string;
  discord_bot_token?: string;
  discord_target_user_id?: string;
};

export type SiteDef = {
  type?: "html" | "browser" | "api" | "embedded";
  selectors?: Selectors;
  api?: ApiConfig;
  browser?: BrowserFetchOptions;
  embedded?: EmbeddedJsonConfig;
};

export type TargetDef = {
  site: string;
  url: string;
  region?: string;
  enabled?: boolean;
  /** Only keep items whose title or description matches one of these keywords (case-insensitive) */
  keywords?: string[];
  /** Auto-discover: try incrementing the trailing number in the URL to find the latest page */
  auto_discover?: boolean;
};

const DEFAULTS: Settings = {
  interval_minutes: 60,
  rate_limit_seconds: 5,
};

/**
 * Resolve env-var placeholders like "${DISCORD_WEBHOOK_URL}" in string values.
 */
function resolveEnvVars(val: string): string {
  return val.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? "");
}

function resolveEnvInObject(obj: any): any {
  if (typeof obj === "string") return resolveEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(resolveEnvInObject);
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = resolveEnvInObject(v);
    }
    return out;
  }
  return obj;
}

/**
 * Load and validate config.yml from a given path.
 */
export async function loadConfig(
  configPath: string = path.resolve(process.cwd(), "config.yml"),
): Promise<AppConfig> {
  const raw = await readFile(configPath, "utf8");
  const parsed = YAML.parse(raw);
  const resolved = resolveEnvInObject(parsed);

  const config: AppConfig = {
    settings: { ...DEFAULTS, ...resolved.settings },
    notifications: resolved.notifications ?? { enabled: false },
    sites: resolved.sites ?? {},
    targets: resolved.targets ?? [],
  };

  // basic validation
  for (const t of config.targets) {
    if (!t.site) throw new Error(`target missing "site" field: ${JSON.stringify(t)}`);
    if (!t.url) throw new Error(`target missing "url" field: ${JSON.stringify(t)}`);
    if (!config.sites[t.site]) {
      throw new Error(`target references unknown site "${t.site}". Define it under "sites:" in config.yml`);
    }
  }

  return config;
}

/**
 * Get the SiteDef for a given site key, with rate_limit from settings merged in.
 */
export function getSiteConfig(config: AppConfig, siteKey: string): SiteDef & { rate_limit_seconds: number } {
  const site = config.sites[siteKey];
  if (!site) throw new Error(`unknown site "${siteKey}"`);
  return { ...site, rate_limit_seconds: config.settings.rate_limit_seconds };
}
