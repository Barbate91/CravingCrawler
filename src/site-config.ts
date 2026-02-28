import type { Selectors } from "./parse.js";
import type { ApiConfig } from "./fetch-api.js";
import type { BrowserFetchOptions } from "./fetch-browser.js";

/**
 * Unified site configuration loaded from config/sites/<site>.yml.
 *
 * `type` controls which fetch strategy is used:
 *  - "html"    (default) — plain HTTP fetch + Cheerio parsing
 *  - "browser" — Puppeteer headless fetch + Cheerio parsing
 *  - "api"     — JSON API fetch with path-based extraction
 */
export type SiteConfig = {
  type?: "html" | "browser" | "api";

  /** CSS selectors for html/browser modes */
  selectors?: Selectors;

  /** API-mode configuration */
  api?: ApiConfig;

  /** Browser-mode options (waitForSelector, timeout, etc.) */
  browser?: BrowserFetchOptions;

  /** Rate limit between requests in seconds */
  rate_limit_seconds?: number;

  /** Schedule hint (used by scheduler) */
  schedule?: string;
};
