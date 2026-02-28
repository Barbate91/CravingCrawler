#!/usr/bin/env bun

import { setTimeout as sleep } from "timers/promises";
import { mkdir } from "fs/promises";
import path from "path";

import { fetchHtml } from "./fetch.js";
import { fetchHtmlWithBrowser } from "./fetch-browser.js";
import { fetchFromApi } from "./fetch-api.js";
import { fetchFromEmbeddedJson } from "./fetch-embedded.js";
import { parseSpecialsFromHtml, Selectors, Special } from "./parse.js";
import { writeJsonToPath } from "./output.js";
import { sendDiscordWebhook, sendDiscordMessageFromEnv } from "./notify.js";
import { loadPreviousItems, findNewItems, findRemovedItems } from "./diff.js";
import { loadConfig, getSiteConfig, type AppConfig, type TargetDef, type SiteDef } from "./config.js";
import { downloadAndResize } from "./images.js";

// Re-export for backward compat with tests
export type Target = TargetDef;

export type RunOptions = {
  onlySite?: string;
  dryRun?: boolean;
  notify?: boolean;
  webhookOverride?: string | null;
  /** Base directory for persisted data (default: cwd/data) */
  dataDir?: string;
  /** If true, notify for all items even if they aren't new */
  notifyAll?: boolean;
  /** Merged app config — passed in so tests can inject it */
  appConfig?: AppConfig;
};

export type RunResult = {
  target: Target;
  items: Special[];
  newItems: Special[];
  removedItems: Special[];
  error?: unknown;
};

/**
 * Fetch items for a single target using the appropriate strategy.
 */
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
      const apiCfg = { ...siteCfg.api, url: t.url || siteCfg.api.url };
      return fetchFromApi(apiCfg, 3, rateLimit);
    }
    case "embedded": {
      if (!siteCfg.embedded) throw new Error(`site config for "${t.site}" has type:embedded but no embedded config`);
      return fetchFromEmbeddedJson(t.url, siteCfg.embedded, 3, rateLimit);
    }
    case "browser": {
      const selectors = siteCfg.selectors ?? { title: "h1" };
      const html = await fetchHtmlWithBrowser(t.url, siteCfg.browser ?? {}, 3, rateLimit);
      return parseSpecialsFromHtml(html, selectors);
    }
    case "html":
    default: {
      const selectors = siteCfg.selectors ?? { title: "h1" };
      const html = await fetchHtml(t.url, 3, rateLimit);
      return parseSpecialsFromHtml(html, selectors);
    }
  }
}

/**
 * Auto-discover the latest version of a URL with an incrementing trailing number.
 * e.g. /shop/SeasonalandHoliday/16 → tries /17, /18, ... until a 404, returns the last working URL.
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

  // Probe up to 20 increments ahead
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

  if (lastGood !== baseUrl) {
    console.log(`[auto-discover] Upgraded ${baseUrl} → ${lastGood}`);
  }
  return lastGood;
}

export async function runTargets(targets: TargetDef[], opts: RunOptions = {}): Promise<RunResult[]> {
  const dataDir = opts.dataDir ?? path.resolve(process.cwd(), "data");
  const config = opts.appConfig ?? await loadConfig();
  const results: RunResult[] = [];

  for (const t of targets) {
    if (opts.onlySite && t.site !== opts.onlySite) continue;
    if (t.enabled === false) continue;
    try {
      const siteCfg = getSiteConfig(config, t.site);

      // Auto-discover: try incrementing trailing number in URL to find latest page
      let targetUrl = t.url;
      if (t.auto_discover) {
        targetUrl = await autoDiscoverUrl(t.url, siteCfg);
      }

      let items = await fetchItems({ ...t, url: targetUrl }, siteCfg);

      // Keyword filtering: only keep items matching at least one keyword
      if (t.keywords && t.keywords.length > 0) {
        const lowerKeywords = t.keywords.map((k) => k.toLowerCase());
        items = items.filter((item) => {
          const text = `${item.title} ${item.description ?? ""}`.toLowerCase();
          return lowerKeywords.some((kw) => text.includes(kw));
        });
      }

      // Download and resize images to local WebP thumbnails
      if (!opts.dryRun) {
        for (const item of items) {
          if (item.image && item.image.startsWith("http")) {
            const slug = item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
            item.image = await downloadAndResize(item.image, t.site, slug);
          }
        }
      }

      // diff against previous run
      const previous = await loadPreviousItems(dataDir, t.site, t.region);
      const newItems = previous ? findNewItems(previous, items) : items;
      const removedItems = previous ? findRemovedItems(previous, items) : [];

      results.push({ target: t, items, newItems, removedItems });

      // persist output
      if (!opts.dryRun && items.length > 0) {
        const date = new Date().toISOString().slice(0, 10);
        const safeSite = t.site.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
        const safeRegion = (t.region ?? "default").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
        const outdir = path.join(dataDir, safeSite, safeRegion);
        await mkdir(outdir, { recursive: true });
        const outPath = path.join(outdir, `${date}.json`);
        await writeJsonToPath(items, outPath);
      }

      // notification — only fire for new or removed items (unless notifyAll)
      if (opts.notify) {
        const itemsToReport = opts.notifyAll ? items : newItems;
        const parts: string[] = [];

        if (itemsToReport.length > 0) {
          const short = itemsToReport.map((i) => `  • ${i.title}${i.price ? ` — ${i.price}` : ""}`).slice(0, 6).join("\n");
          parts.push(`🆕 ${itemsToReport.length} new item(s):\n${short}`);
        }
        if (removedItems.length > 0) {
          const short = removedItems.map((i) => `  • ${i.title}`).slice(0, 4).join("\n");
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
      results.push({ target: t, items: [], newItems: [], removedItems: [], error: err });
    }
  }
  return results;
}

/**
 * Run a single pass: load config, run all targets, print summary.
 */
async function runOnce(opts: {
  configPath?: string;
  onlySite?: string;
  dryRun?: boolean;
  notify?: boolean;
  notifyAll?: boolean;
  webhook?: string;
  dataDir: string;
}) {
  const config = await loadConfig(opts.configPath);
  const targets = config.targets;
  const webhookOverride = opts.webhook ?? config.notifications.discord_webhook_url ?? null;
  const shouldNotify = opts.notify ?? config.notifications.enabled;

  const res = await runTargets(targets, {
    onlySite: opts.onlySite,
    dryRun: opts.dryRun,
    notify: shouldNotify,
    notifyAll: opts.notifyAll,
    webhookOverride,
    dataDir: opts.dataDir,
    appConfig: config,
  });

  // print short summary
  const summary = res.map(r => ({
    site: r.target.site,
    url: r.target.url,
    total: r.items.length,
    new: r.newItems.length,
    removed: r.removedItems.length,
    error: r.error ? String(r.error) : null,
  }));
  console.log(JSON.stringify(summary, null, 2));

  return { config, results: res };
}

// Lightweight CLI wrapper so this can be run by cron / container / GH Actions
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const configPath = argv.includes("--config") ? argv[argv.indexOf("--config") + 1] : undefined;
  const onlySite = argv.includes("--only-site") ? argv[argv.indexOf("--only-site") + 1] : undefined;
  const dryRun = argv.includes("--dry-run");
  const notify = argv.includes("--notify");
  const notifyAll = argv.includes("--notify-all");
  const webhook = argv.includes("--webhook") ? argv[argv.indexOf("--webhook") + 1] : undefined;
  const loopFlag = argv.includes("--loop");
  const dataDir = argv.includes("--data-dir")
    ? path.resolve(argv[argv.indexOf("--data-dir") + 1])
    : path.resolve(process.cwd(), "data");

  const runOpts = { configPath, onlySite, dryRun, notify, notifyAll, webhook, dataDir };

  if (loopFlag) {
    // Loop mode: run forever, sleeping between passes
    console.log("[CravingCrawler] Starting in loop mode...");
    while (true) {
      const startTime = Date.now();
      try {
        const { config } = await runOnce(runOpts);
        const intervalMs = (config.settings.interval_minutes ?? 60) * 60 * 1000;
        const elapsed = Date.now() - startTime;
        const sleepMs = Math.max(0, intervalMs - elapsed);
        console.log(`[CravingCrawler] Next run in ${Math.round(sleepMs / 60000)} minutes`);
        await sleep(sleepMs);
      } catch (err) {
        console.error("[CravingCrawler] Error during run:", err);
        // sleep 5 min on error before retrying
        await sleep(5 * 60 * 1000);
      }
    }
  } else {
    // Single-pass mode
    await runOnce(runOpts);
  }
}
