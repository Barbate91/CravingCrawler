import { setTimeout as sleep } from "timers/promises";
import { load } from "cheerio";
import type { Special } from "./parse.js";

export type EmbeddedJsonConfig = {
  /** CSS selector for the <script> tag containing JSON (default: #__NEXT_DATA__) */
  scriptSelector?: string;
  /** Dot-notation path to the array of items within the JSON, e.g. "props.pageProps.products.rotatingMenu.items" */
  itemsPath: string;
  /** Dot-notation path within each item to the title */
  titleKey: string;
  /** Dot-notation path within each item to the price (optional) */
  priceKey?: string;
  /** Dot-notation path within each item to the description (optional) */
  descriptionKey?: string;
  /** Dot-notation path within each item to the image URL (optional) */
  imageKey?: string;
};

/**
 * Fetch a page, extract embedded JSON from a <script> tag, and map items to Special[].
 * Works with Next.js __NEXT_DATA__, Nuxt __NUXT__, or any inline JSON blob.
 */
export async function fetchFromEmbeddedJson(
  url: string,
  config: EmbeddedJsonConfig,
  attempts = 3,
  rateLimitSeconds = 5,
): Promise<Special[]> {
  const ua = process.env.USER_AGENT ?? "CravingCrawler/0.1 (+https://github.com/Barbate91/CravingCrawler)";
  const selector = config.scriptSelector ?? "#__NEXT_DATA__";
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(2 ** i * 100);
    try {
      const res = await fetch(url, { headers: { "user-agent": ua } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      const $ = load(html);
      const scriptContent = $(selector).html();
      if (!scriptContent) {
        throw new Error(`No script tag found matching "${selector}"`);
      }

      const json = JSON.parse(scriptContent);
      const items = getByPath(json, config.itemsPath);
      if (!Array.isArray(items)) {
        throw new Error(`itemsPath "${config.itemsPath}" did not resolve to an array`);
      }

      const specials: Special[] = items.map((item: any) => ({
        title: String(getByPath(item, config.titleKey) ?? ""),
        price: config.priceKey ? String(getByPath(item, config.priceKey) ?? "") || null : null,
        description: config.descriptionKey ? String(getByPath(item, config.descriptionKey) ?? "") || undefined : undefined,
        image: config.imageKey ? String(getByPath(item, config.imageKey) ?? "") || undefined : undefined,
      }));

      if (rateLimitSeconds > 0) await sleep(rateLimitSeconds * 1000);
      return specials;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
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
