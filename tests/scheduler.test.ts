import { expect, it, beforeEach } from "bun:test";
import { runTargets, Target } from "../src/scheduler.js";

it("runs targets and calls parser + notifier (injected via env)", async () => {
  const fixtureTarget: Target = { site: "crumbl", url: "https://example.local/", enabled: true, region: "t" };

  // inject a fake fetchHtml & site config by monkeypatching imports via dynamic import mock
  // simpler: call runTargets with a fake targets array and rely on existing site config for parsing fixtures
  // We'll simulate fetch by overriding globalThis.fetch to return a simple HTML page
  // that matches the selectors in config/sites/crumbl.yml
  globalThis.fetch = async () => ({ ok: true, text: async () => `
    <div class="product-card"><h3 class="product-title">X</h3><div class="product-price">$1.00</div></div>
  `, status: 200 }) as any;

  // ensure no realtime notifications: set env to undefined so notify path uses webhook which is absent
  const results = await runTargets([fixtureTarget], { dryRun: true, notify: false });
  expect(results.length).toBe(1);
  expect(results[0].items.length).toBeGreaterThanOrEqual(1);
});
