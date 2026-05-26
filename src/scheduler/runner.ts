import { mkdir } from "fs/promises";
import path from "path";

import { fetchHtml } from "../fetch.js";
import { fetchHtmlWithBrowser } from "../fetch-browser.js";
import { fetchFromApi } from "../fetch-api.js";
import { fetchFromEmbeddedJson } from "../fetch-embedded.js";
import { parseSpecialsFromHtml, type Special } from "../parse.js";
import { writeJsonToPath } from "../output.js";
import { sendDiscordWebhook, sendDiscordMessageFromEnv } from "../notify.js";
import { loadPreviousItems, findNewItems, findRemovedItems } from "../diff.js";
import { getSiteConfig, type AppConfig, type TargetDef, type SiteDef } from "../config.js";
import { downloadAndResize } from "../images.js";

export type Target = TargetDef;

export type RunOptions = {
  onlySite?: string;
  dryRun?: boolean;
  notify?: boolean;
  webhookOverride?: string | null;
  dataDir?: string;
  notifyAll?: boolean;
  appConfig?: AppConfig;
};

export type RunResult = {
  target: Target;
  items: Special[];
  newItems: Special[];
  removedItems: Special[];
  error?: unknown;
};

async function fetchItems(
  t: TargetDef,
  siteCfg: SiteDef & { rate_limit_seconds: number },
): Promise<Special[]> {
  const mode = siteCfg.type ?? "html";
  const envOverride = process.env.RATE_LIMIT_SECONDS;
  const rateLimit = envOverride !== undefined ? Number(envOverride) : siteCfg.rate_limit_seconds;

  switch (mode) {
    case "api": {
      if (!siteCfg.api) throw new Error(`site config for "${t.site}" has type:api but no api config`);
      return fetchFromApi({ ...siteCfg.api, url: t.url || siteCfg.api.url }, 3, rateLimit);
    }
    case "embedded": {
      if (!siteCfg.embedded) throw new Error(`site config for "${t.site}" has type:embedded but no embedded config`);
      return fetchFromEmbeddedJson(t.url, siteCfg.embedded, 3, rateLimit);
    }
    case "browser": {
      const html = await fetchHtmlWithBrowser(t.url, siteCfg.browser ?? {}, 3, rateLimit);
      return parseSpecialsFromHtml(html, siteCfg.selectors ?? { title: "h1" });
    }
    case "html":
    default: {
      const html = await fetchHtml(t.url, 3, rateLimit);
      return parseSpecialsFromHtml(html, siteCfg.selectors ?? { title: "h1" });
    }
  }
}

/**
 * Auto-discover the latest version of a URL with an incrementing trailing number.
 */
async function autoDiscoverUrl(baseUrl: string, _siteCfg: SiteDef & { rate_limit_seconds: number }): Promise<string> {
  const match = baseUrl.match(/^(.+\/)(\d+)(\/?)$/);
  if (!match) {
    console.log(`[auto-discover] URL "${baseUrl}" has no trailing number, using as-is`);
    return baseUrl;
  }

  const [, prefix, numStr, trailing] = match;
  let current = parseInt(numStr, 10);
  let lastGood = baseUrl;
  const ua = process.env.USER_AGENT ?? "CravingCrawler/0.1 (+https://github.com/Barbate91/CravingCrawler)";

  for (let i = 1; i <= 20; i++) {
    const candidate = `${prefix}${current + i}${trailing}`;
    try {
      const res = await fetch(candidate, { method: "HEAD", headers: { "user-agent": ua }, redirect: "follow" });
      if (res.ok) {
        lastGood = candidate;
        console.log(`[auto-discover] Found newer page: ${candidate}`);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (lastGood !== baseUrl) console.log(`[auto-discover] Upgraded ${baseUrl} → ${lastGood}`);
  return lastGood;
}

export async function runTargets(targets: TargetDef[], opts: RunOptions = {}): Promise<RunResult[]> {
  const dataDir = opts.dataDir ?? path.resolve(process.cwd(), "data");
  const config = opts.appConfig;
  if (!config) throw new Error("runTargets requires opts.appConfig to be provided");
  const results: RunResult[] = [];

  for (const t of targets) {
    if (opts.onlySite && t.site !== opts.onlySite) continue;
    if (t.enabled === false) continue;
    const label = `${t.site}/${t.region ?? "default"}`;
    try {
      const siteCfg = getSiteConfig(config, t.site);
      const mode = siteCfg.type ?? "html";

      let targetUrl = t.url;
      if (t.auto_discover) targetUrl = await autoDiscoverUrl(t.url, siteCfg);

      console.log(`[scrape] ${label} — fetching via ${mode} (${targetUrl})`);
      const fetchStart = Date.now();
      let items = await fetchItems({ ...t, url: targetUrl }, siteCfg);
      console.log(`[scrape] ${label} — fetched ${items.length} item(s) in ${Date.now() - fetchStart}ms`);

      if (t.keywords?.length) {
        const lower = t.keywords.map(k => k.toLowerCase());
        items = items.filter(item => lower.some(kw => `${item.title} ${item.description ?? ""}`.toLowerCase().includes(kw)));
      }

      if (t.exclude_keywords?.length) {
        const lower = t.exclude_keywords.map(k => k.toLowerCase());
        items = items.filter(item => !lower.some(kw => `${item.title} ${item.description ?? ""}`.toLowerCase().includes(kw)));
      }

      items = items.filter(item => item.title.trim().length > 0);

      if (t.exclude_date_titles) {
        items = items.filter(item => !/^\d{1,2}\/\d{1,2}\//.test(item.title));
      }

      if (t.max_items && t.max_items > 0) items = items.slice(0, t.max_items);

      const baseUrl = new URL(t.url);
      for (const item of items) {
        if (item.image && !item.image.startsWith("http")) {
          item.image = new URL(item.image, baseUrl).href;
        }
      }

      if (siteCfg.detail_description_selector && !opts.dryRun) {
        for (const item of items) {
          if (item.link && !item.description) {
            try {
              const detailUrl = item.link.startsWith("http") ? item.link : `${baseUrl.origin}${item.link}`;
              const detailHtml = siteCfg.type === "browser"
                ? await fetchHtmlWithBrowser(detailUrl, { timeout: 15000 }, 2, siteCfg.rate_limit_seconds ?? 5)
                : await fetchHtml(detailUrl, 2, siteCfg.rate_limit_seconds ?? 5);
              const { load } = await import("cheerio");
              const desc = load(detailHtml)(siteCfg.detail_description_selector).text().trim();
              if (desc) item.description = desc;
            } catch (err) {
              console.warn(`[detail-page] Failed to fetch description for "${item.title}":`, err);
            }
          }
        }
      }

      if (!opts.dryRun) {
        const withImages = items.filter(i => i.image?.startsWith("http"));
        if (withImages.length > 0) console.log(`[scrape] ${label} — downloading ${withImages.length} image(s)`);
        for (const item of items) {
          if (item.image?.startsWith("http")) {
            const slug = item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
            item.image = await downloadAndResize(item.image, t.site, slug);
          }
        }
      }

      const previous = await loadPreviousItems(dataDir, t.site, t.region);
      const newItems = previous ? findNewItems(previous, items) : items;
      const removedItems = previous ? findRemovedItems(previous, items) : [];
      console.log(`[scrape] ${label} — done: ${items.length} total, +${newItems.length} new, -${removedItems.length} removed`);

      results.push({ target: t, items, newItems, removedItems });

      if (!opts.dryRun && items.length > 0) {
        const date = new Date().toISOString().slice(0, 10);
        const outdir = path.join(
          dataDir,
          t.site.replace(/[^a-z0-9_-]/gi, "-").toLowerCase(),
          (t.region ?? "default").replace(/[^a-z0-9_-]/gi, "-").toLowerCase(),
        );
        await mkdir(outdir, { recursive: true });
        await writeJsonToPath(items, path.join(outdir, `${date}.json`));
      }

      if (opts.notify) {
        const itemsToReport = opts.notifyAll ? items : newItems;
        const parts: string[] = [];

        if (itemsToReport.length > 0) {
          const short = itemsToReport.map(i => `  • ${i.title}${i.price ? ` — ${i.price}` : ""}`).slice(0, 6).join("\n");
          parts.push(`🆕 ${itemsToReport.length} new item(s):\n${short}`);
        }
        if (removedItems.length > 0) {
          const short = removedItems.map(i => `  • ${i.title}`).slice(0, 4).join("\n");
          parts.push(`⏳ ${removedItems.length} leaving soon:\n${short}`);
        }

        if (parts.length > 0) {
          const message = `**CravingCrawler** — ${t.site} (${t.region ?? "default"})\n${parts.join("\n")}`;
          try {
            const webhook = opts.webhookOverride ?? process.env.DISCORD_WEBHOOK_URL ?? null;
            if (webhook) {
              await sendDiscordWebhook(webhook, message);
            } else {
              await sendDiscordMessageFromEnv(message, { targetUser: process.env.DISCORD_TARGET_USER_ID });
            }
          } catch (err) {
            console.warn("notification failed", err);
          }
        }
      }
    } catch (err) {
      console.error(`[scrape] ${label} — error: ${err instanceof Error ? err.message : err}`);
      results.push({ target: t, items: [], newItems: [], removedItems: [], error: err });
    }
  }
  return results;
}
