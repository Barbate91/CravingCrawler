// Production entry point.
// Starts the Astro SSR server, then manually triggers the scraper loop.
// The scraper integration's astro:server:start hook is dev-only, so we invoke it here.

await import("../dist/server/entry.mjs");

import scraperIntegration from "./integrations/scraper.ts";
const integration = scraperIntegration();
await integration.hooks["astro:server:start"]!({} as any);
