import { setTimeout as sleep } from "timers/promises";
import type { Special } from "./parse.js";

export type ApiConfig = {
  /** JSON API endpoint URL */
  url: string;
  /** JSONPath-like dot-notation path to the array of items, e.g. "data.items" */
  itemsPath: string;
  /** Key within each item object for the title */
  titleKey: string;
  /** Key within each item object for the price (optional) */
  priceKey?: string;
  /** Key within each item for a description (optional) */
  descriptionKey?: string;
  /** Key within each item for an image URL (optional) */
  imageKey?: string;
  /** Extra headers to send (e.g. API keys) */
  headers?: Record<string, string>;
};

/**
 * Fetch specials from a JSON API endpoint and map them to Special[].
 */
export async function fetchFromApi(
  config: ApiConfig,
  attempts = 3,
  rateLimitSeconds = 5,
): Promise<Special[]> {
  const ua = process.env.USER_AGENT ?? "CravingCrawler/0.1 (+https://github.com/Barbate91/CravingCrawler)";
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(2 ** i * 100);
    try {
      const res = await fetch(config.url, {
        headers: { "user-agent": ua, ...config.headers },
      });
      if (!res.ok) throw new Error(`API HTTP ${res.status}`);
      const json = await res.json();
      const items = extractByPath(json, config.itemsPath);
      if (!Array.isArray(items)) {
        throw new Error(`itemsPath "${config.itemsPath}" did not resolve to an array`);
      }

      const specials: Special[] = items.map((item: any) => ({
        title: String(getByPath(item, config.titleKey) ?? ""),
        price: config.priceKey ? String(getByPath(item, config.priceKey) ?? "") : null,
        description: config.descriptionKey ? String(getByPath(item, config.descriptionKey) ?? "") : undefined,
        image: config.imageKey ? String(getByPath(item, config.imageKey) ?? "") : undefined,
      }));

      if (rateLimitSeconds > 0) await sleep(rateLimitSeconds * 1000);
      return specials;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Resolve a dot-notation path like "data.items" against an object.
 */
function extractByPath(obj: any, path: string): unknown {
  return getByPath(obj, path);
}

function getByPath(obj: any, path: string): unknown {
  const parts = path.split(".");
  let current = obj;
  for (const p of parts) {
    if (current == null) return undefined;
    current = current[p];
  }
  return current;
}
