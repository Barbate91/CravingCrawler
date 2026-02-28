import { setTimeout as sleep } from "timers/promises";

export type BrowserFetchOptions = {
  /** CSS selector to wait for before extracting HTML (ensures JS has rendered) */
  waitForSelector?: string;
  /** Max time in ms to wait for the selector (default: 15000) */
  timeout?: number;
};

/**
 * Fetch a page using Playwright (headless Chromium) for JS-rendered content.
 * Returns the fully-rendered HTML string.
 *
 * Playwright is dynamically imported so it's only required when a site
 * config sets `type: browser`.
 */
export async function fetchHtmlWithBrowser(
  url: string,
  opts: BrowserFetchOptions = {},
  attempts = 3,
  rateLimitSeconds = 5,
): Promise<string> {
  const { chromium } = await import("playwright");

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(2 ** i * 100);
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          process.env.USER_AGENT ??
          "CravingCrawler/0.1 (+https://github.com/Barbate91/CravingCrawler)",
      });
      const page = await context.newPage();
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: opts.timeout ?? 15000,
      });

      if (opts.waitForSelector) {
        await page.waitForSelector(opts.waitForSelector, {
          timeout: opts.timeout ?? 15000,
        });
      }

      const html = await page.content();
      await browser.close();
      if (rateLimitSeconds > 0) await sleep(rateLimitSeconds * 1000);
      return html;
    } catch (err) {
      lastErr = err;
      try { await browser?.close(); } catch { /* ignore */ }
    }
  }
  throw lastErr;
}
