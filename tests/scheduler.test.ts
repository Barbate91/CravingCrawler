import { expect, it, beforeEach, afterEach } from "bun:test";
import { runTargets, Target } from "../src/scheduler.js";
import type { AppConfig } from "../src/config.js";
import { tmpdir } from "os";
import path from "path";

const originalFetch = globalThis.fetch;
const originalRateLimit = process.env.RATE_LIMIT_SECONDS;

beforeEach(() => {
  // disable rate-limit sleep in fetchHtml
  process.env.RATE_LIMIT_SECONDS = "0";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalRateLimit === undefined) delete process.env.RATE_LIMIT_SECONDS;
  else process.env.RATE_LIMIT_SECONDS = originalRateLimit;
});

// Minimal AppConfig so the scheduler doesn't try to load config.yml from disk
const testConfig: AppConfig = {
  settings: { interval_minutes: 60, rate_limit_seconds: 0 },
  notifications: { enabled: false },
  sites: {
    crumbl: {
      type: "html",
      selectors: { item: ".product-card", title: ".product-title", price: ".product-price" },
    },
  },
  targets: [],
};

it("runs targets and calls parser + notifier (injected via env)", async () => {
  const fixtureTarget: Target = { site: "crumbl", url: "https://example.local/", enabled: true, region: "t" };

  // We'll simulate fetch by overriding globalThis.fetch to return a simple HTML page
  // that matches the selectors in the test config
  globalThis.fetch = async () => ({ ok: true, text: async () => `
    <div class="product-card"><h3 class="product-title">X</h3><div class="product-price">$1.00</div></div>
  `, status: 200 }) as any;

  // use a temp data dir so diff module doesn't hang looking for previous data
  const dataDir = path.join(tmpdir(), `cravingcrawler-test-${Date.now()}`);
  const results = await runTargets([fixtureTarget], { dryRun: true, notify: false, dataDir, appConfig: testConfig });
  expect(results.length).toBe(1);
  expect(results[0].items.length).toBeGreaterThanOrEqual(1);
  expect(results[0].newItems.length).toBeGreaterThanOrEqual(1);
  expect(results[0].removedItems.length).toBe(0);
});
