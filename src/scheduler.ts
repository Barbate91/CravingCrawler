#!/usr/bin/env bun

import YAML from "yaml";
import { readFile, mkdir } from "fs/promises";
import path from "path";

import { fetchHtml } from "./fetch.js";
import { parseSpecialsFromHtml, Selectors } from "./parse.js";
import { writeJsonToPath, toJson } from "./output.js";
import { sendDiscordWebhook, sendDiscordMessageFromEnv } from "./notify.js";

export type Target = {
  site: string;
  url: string;
  region?: string;
  enabled?: boolean;
  schedule?: string;
  selectors?: Partial<Selectors>;
};

export type RunOptions = {
  onlySite?: string;
  dryRun?: boolean;
  notify?: boolean;
  webhookOverride?: string | null;
};

export async function loadTargets(file = new URL("../config/targets.yml", import.meta.url)) {
  const raw = await readFile(file, "utf8");
  return YAML.parse(raw) as Target[];
}

export async function loadSiteConfig(site: string) {
  const raw = await readFile(new URL(`../config/sites/${site}.yml`, import.meta.url), "utf8");
  return YAML.parse(raw) as any;
}

export function mergeSelectors(siteSelectors: any, targetSelectors?: Partial<Selectors>): Selectors {
  return { ...(siteSelectors ?? {}), ...(targetSelectors ?? {}) } as Selectors;
}

export async function runTargets(targets: Target[], opts: RunOptions = {}) {
  const results: Array<{ target: Target; items: any[]; error?: unknown }> = [];
  for (const t of targets) {
    if (opts.onlySite && t.site !== opts.onlySite) continue;
    if (t.enabled === false) continue;
    try {
      const siteCfg = await loadSiteConfig(t.site);
      const selectors = mergeSelectors(siteCfg?.selectors ?? {}, t.selectors);
      const html = await fetchHtml(t.url);
      const items = parseSpecialsFromHtml(html, selectors);
      results.push({ target: t, items });

      if (!opts.dryRun && items.length > 0) {
        // persist output
        const date = new Date().toISOString().slice(0, 10);
        const safeSite = t.site.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
        const safeRegion = (t.region ?? "default").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
        const outdir = path.resolve(process.cwd(), `data/${safeSite}/${safeRegion}`);
        await mkdir(outdir, { recursive: true });
        const outPath = path.join(outdir, `${date}.json`);
        await writeJsonToPath(items, outPath);
      }

      // notification
      if (opts.notify && items.length > 0) {
        const short = items.map((i) => `${i.title}${i.price ? ` — ${i.price}` : ""}`).slice(0, 6).join("\n");
        const message = `CravingCrawler: ${items.length} new item(s) for ${t.site} (${t.region ?? "-"})\n${short}`;
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
    } catch (err) {
      results.push({ target: t, items: [], error: err });
    }
  }
  return results;
}

// Lightweight CLI wrapper so this can be run by cron / container / GH Actions
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const onlySite = argv.includes("--only-site") ? argv[argv.indexOf("--only-site") + 1] : undefined;
  const dryRun = argv.includes("--dry-run");
  const notify = argv.includes("--notify");
  const webhook = argv.includes("--webhook") ? argv[argv.indexOf("--webhook") + 1] : undefined;
  const targets = await loadTargets();
  const res = await runTargets(targets, { onlySite, dryRun, notify, webhookOverride: webhook ?? null });
  // print short summary
  console.log(JSON.stringify(res.map(r => ({ site: r.target.site, url: r.target.url, count: r.items.length, error: !!r.error })), null, 2));
}
