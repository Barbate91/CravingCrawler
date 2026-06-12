import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Special } from "../parse.js";

export type SiteSummary = {
  site: string;
  region: string;
  date: string;
  /** ISO timestamp of the last successful scrape (mtime of the latest data file). */
  scrapedAt: string | null;
  items: Special[];
};

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");

/**
 * Scan the data directory and load the latest results for every site/region.
 * Called at request time in SSR mode so data is always fresh.
 */
export async function loadAllLatest(): Promise<SiteSummary[]> {
  const summaries: SiteSummary[] = [];
  let sites: string[];
  try {
    sites = await readdir(DATA_DIR);
  } catch {
    return summaries;
  }

  for (const site of sites) {
    const sitePath = path.join(DATA_DIR, site);
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
      const latestPath = path.join(regionPath, latestFile);
      let items: Special[];
      try {
        const raw = await readFile(latestPath, "utf8");
        items = JSON.parse(raw) as Special[];
      } catch (err) {
        console.warn(`[data] Skipping corrupt file ${latestPath}:`, err);
        continue;
      }
      let scrapedAt: string | null = null;
      try {
        scrapedAt = (await stat(latestPath)).mtime.toISOString();
      } catch {
        // freshness is best-effort; the data itself still renders
      }
      summaries.push({ site, region, date, scrapedAt, items });
    }
  }

  return summaries.sort((a, b) => a.site.localeCompare(b.site) || a.region.localeCompare(b.region));
}

/**
 * Load summary for a specific site (all regions).
 */
export async function loadSite(siteKey: string): Promise<SiteSummary[]> {
  const all = await loadAllLatest();
  return all.filter((s) => s.site === siteKey);
}

/**
 * Load history for a specific site/region (all dates).
 */
export async function loadHistory(siteKey: string, region: string): Promise<{ date: string; items: Special[] }[]> {
  const regionPath = path.join(DATA_DIR, siteKey, region);
  let files: string[];
  try {
    files = await readdir(regionPath);
  } catch {
    return [];
  }
  const jsonFiles = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();

  const history: { date: string; items: Special[] }[] = [];
  for (const f of jsonFiles.slice(0, 14)) {
    const date = f.replace(".json", "");
    try {
      const raw = await readFile(path.join(regionPath, f), "utf8");
      history.push({ date, items: JSON.parse(raw) });
    } catch (err) {
      console.warn(`[data] Skipping corrupt file ${path.join(regionPath, f)}:`, err);
    }
  }
  return history;
}
