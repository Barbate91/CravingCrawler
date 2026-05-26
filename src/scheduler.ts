#!/usr/bin/env bun

import { setTimeout as sleep } from "timers/promises";
import path from "path";

import { loadConfig } from "./config.js";
import { writeStaticPage } from "./static-page.js";
import { runTargets } from "./scheduler/runner.js";

export type { Target, RunOptions, RunResult } from "./scheduler/runner.js";
export { runTargets } from "./scheduler/runner.js";

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

  const activeTargets = targets.filter(t => t.enabled !== false && (!opts.onlySite || t.site === opts.onlySite));
  console.log(`[CravingCrawler] Scrape started — ${activeTargets.length} target(s)`);
  const runStart = Date.now();

  const res = await runTargets(targets, {
    onlySite: opts.onlySite,
    dryRun: opts.dryRun,
    notify: shouldNotify,
    notifyAll: opts.notifyAll,
    webhookOverride,
    dataDir: opts.dataDir,
    appConfig: config,
  });

  const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);
  const succeeded = res.filter(r => !r.error).length;
  console.log(`[CravingCrawler] Scrape finished in ${elapsed}s — ${succeeded}/${res.length} succeeded`);

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

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const configPath = argv.includes("--config") ? argv[argv.indexOf("--config") + 1] : undefined;
  const onlySite = argv.includes("--only-site") ? argv[argv.indexOf("--only-site") + 1] : undefined;
  const dryRun = argv.includes("--dry-run");
  const notify = argv.includes("--notify");
  const notifyAll = argv.includes("--notify-all");
  const webhook = argv.includes("--webhook") ? argv[argv.indexOf("--webhook") + 1] : undefined;
  const loopFlag = argv.includes("--loop");
  const pageFlag = argv.includes("--page");
  const dataDir = argv.includes("--data-dir")
    ? path.resolve(argv[argv.indexOf("--data-dir") + 1])
    : path.resolve(process.cwd(), "data");

  const runOpts = { configPath, onlySite, dryRun, notify, notifyAll, webhook, dataDir };

  if (loopFlag) {
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
        await sleep(5 * 60 * 1000);
      }
    }
  } else {
    const { results } = await runOnce(runOpts);
    if (pageFlag) {
      const outPath = path.resolve(process.cwd(), "public/index.html");
      await writeStaticPage(dataDir, outPath);
      console.log(`[CravingCrawler] Static page written to ${outPath}`);
    }
    const hasErrors = results.some(r => r.error);
    process.exit(hasErrors ? 1 : 0);
  }
}
