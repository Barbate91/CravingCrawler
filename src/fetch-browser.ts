import { setTimeout as sleep } from "timers/promises";

export type BrowserFetchOptions = {
  /** CSS selector to wait for before extracting HTML (ensures JS has rendered) */
  waitForSelector?: string;
  /** Max time in ms to wait for the selector (default: 15000) */
  timeout?: number;
  /** CSS selector for an element to click before extracting (e.g. a category tab) */
  clickSelector?: string;
  /** CSS selector to scope extracted HTML to (returns outerHTML of that element instead of full page) */
  sectionSelector?: string;
  /** JS code string evaluated in-page that returns an HTML string (for complex scoping logic) */
  sectionScript?: string;
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

      if (opts.clickSelector) {
        // Use locator for richer selector support (text=, :has-text, etc.)
        await page.locator(opts.clickSelector).first().click({ timeout: opts.timeout ?? 15000 });
        await sleep(2000); // wait for re-render after click
        if (opts.waitForSelector) {
          await page.waitForSelector(opts.waitForSelector, {
            timeout: opts.timeout ?? 15000,
          });
        }
      }

      let html: string;
      if (opts.sectionScript) {
        html = await page.evaluate(opts.sectionScript);
      } else if (opts.sectionSelector) {
        html = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : document.documentElement.outerHTML;
        }, opts.sectionSelector);
      } else {
        html = await page.content();
      }
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
