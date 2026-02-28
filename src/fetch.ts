import { setTimeout as sleep } from "timers/promises";

function getDefaultRateLimit() {
  return Number(process.env.RATE_LIMIT_SECONDS ?? 5);
}

export async function fetchHtml(url: string, attempts = 3, rateLimitSeconds = getDefaultRateLimit()): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(2 ** i * 100);
    try {
      // polite defaults
      const ua = process.env.USER_AGENT ?? "CravingCrawler/0.1 (+https://github.com/Barbate91/CravingCrawler)";
      const res = await fetch(url, { headers: { "user-agent": ua } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // rate-limit between requests when re-used by caller
      if (rateLimitSeconds > 0) await sleep(rateLimitSeconds * 1000);
      return text;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
