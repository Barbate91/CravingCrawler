import { readFile, readdir } from "fs/promises";
import path from "path";
import type { Special } from "./parse.js";

/**
 * Load the most recent saved results for a given site/region from the data directory.
 * Returns null if no previous data exists.
 */
export async function loadPreviousItems(
  dataDir: string,
  site: string,
  region = "default",
): Promise<Special[] | null> {
  const safeSite = site.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const safeRegion = region.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const dir = path.join(dataDir, safeSite, safeRegion);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return null; // directory doesn't exist yet
  }

  // filter to YYYY-MM-DD.json and sort descending
  const jsonFiles = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();

  if (jsonFiles.length === 0) return null;

  const latest = path.join(dir, jsonFiles[0]);
  const raw = await readFile(latest, "utf8");
  return JSON.parse(raw) as Special[];
}

/**
 * Compare two item lists and return only the items in `current` that are new
 * (i.e., their title was not present in `previous`).
 */
export function findNewItems(previous: Special[], current: Special[]): Special[] {
  const prevTitles = new Set(previous.map((i) => normalizeTitle(i.title)));
  return current.filter((i) => !prevTitles.has(normalizeTitle(i.title)));
}

/**
 * Compare two item lists and return items that were in `previous` but are no
 * longer in `current` (useful for "last chance" alerts).
 */
export function findRemovedItems(previous: Special[], current: Special[]): Special[] {
  const currTitles = new Set(current.map((i) => normalizeTitle(i.title)));
  return previous.filter((i) => !currTitles.has(normalizeTitle(i.title)));
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().trim().replace(/\s+/g, " ");
}
