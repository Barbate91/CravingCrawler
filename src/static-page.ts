import { readFile, readdir, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Special } from "./parse.js";

export type SiteSummary = {
  site: string;
  region: string;
  date: string;
  items: Special[];
};

/**
 * Scan the data directory and load the latest results for every site/region.
 */
export async function loadAllLatest(dataDir: string): Promise<SiteSummary[]> {
  const summaries: SiteSummary[] = [];
  let sites: string[];
  try {
    sites = await readdir(dataDir);
  } catch {
    return summaries;
  }

  for (const site of sites) {
    const sitePath = path.join(dataDir, site);
    let regions: string[];
    try {
      regions = await readdir(sitePath);
    } catch {
      continue;
    }
    for (const region of regions) {
      const regionPath = path.join(sitePath, region);
      let files: string[];
      try {
        files = await readdir(regionPath);
      } catch {
        continue;
      }
      const jsonFiles = files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
        .reverse();
      if (jsonFiles.length === 0) continue;

      const latestFile = jsonFiles[0];
      const date = latestFile.replace(".json", "");
      const raw = await readFile(path.join(regionPath, latestFile), "utf8");
      const items = JSON.parse(raw) as Special[];
      summaries.push({ site, region, date, items });
    }
  }

  return summaries;
}

/**
 * Generate a self-contained static HTML page summarizing current offerings.
 */
export function generateHtml(summaries: SiteSummary[], generatedAt = new Date()): string {
  const siteSections = summaries
    .map((s) => {
      const rows = s.items
        .map(
          (item) => `
        <tr>
          <td class="item-title">${esc(item.title)}</td>
          <td class="item-price">${esc(item.price ?? "")}</td>
          <td class="item-desc">${esc(item.description ?? "")}</td>
        </tr>`,
        )
        .join("\n");

      return `
      <section class="site-card">
        <h2>${esc(s.site)} <span class="region">${esc(s.region)}</span></h2>
        <p class="meta">Last updated: ${esc(s.date)} &middot; ${s.items.length} item(s)</p>
        ${
          s.items.length > 0
            ? `<table>
          <thead><tr><th>Item</th><th>Price</th><th>Description</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
            : `<p class="empty">No items found.</p>`
        }
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CravingCrawler — Current Treats</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      background: #faf7f2;
      color: #2d2d2d;
      padding: 2rem 1rem;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      font-size: 1.8rem;
      margin-bottom: 0.25rem;
      color: #b5485d;
    }
    .subtitle {
      color: #888;
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    .site-card {
      background: #fff;
      border: 1px solid #e8e0d8;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .site-card h2 {
      font-size: 1.25rem;
      margin-bottom: 0.25rem;
      text-transform: capitalize;
    }
    .region {
      font-weight: 400;
      font-size: 0.85rem;
      color: #999;
    }
    .meta {
      font-size: 0.8rem;
      color: #aaa;
      margin-bottom: 1rem;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #f0ebe4;
    }
    th { font-size: 0.75rem; text-transform: uppercase; color: #aaa; letter-spacing: 0.05em; }
    .item-title { font-weight: 600; }
    .item-price { color: #b5485d; white-space: nowrap; }
    .item-desc { font-size: 0.85rem; color: #777; }
    .empty { color: #bbb; font-style: italic; }
    footer { text-align: center; font-size: 0.75rem; color: #bbb; margin-top: 2rem; }
    @media (max-width: 600px) {
      body { padding: 1rem 0.5rem; }
      .site-card { padding: 1rem; }
    }
  </style>
</head>
<body>
  <h1>🍪 CravingCrawler</h1>
  <p class="subtitle">Limited-time treats from your favorite spots</p>

  ${summaries.length > 0 ? siteSections : '<p class="empty">No data yet. Run the scheduler first!</p>'}

  <footer>Generated ${esc(generatedAt.toISOString())} by CravingCrawler</footer>
</body>
</html>`;
}

/**
 * Generate and write the static page to disk.
 */
export async function writeStaticPage(dataDir: string, outPath: string): Promise<void> {
  const summaries = await loadAllLatest(dataDir);
  const html = generateHtml(summaries);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
