import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export type WebConfig = {
  hasTargets: boolean;
  enabledTargetCount: number;
  siteCount: number;
  configFound: boolean;
};

const CONFIG_PATH = process.env.CONFIG_PATH ?? path.resolve(process.cwd(), "config.yml");

/**
 * Read config.yml and return a summary the web UI can use for status banners.
 * Gracefully returns defaults if the config file is missing.
 */
export async function loadWebConfig(): Promise<WebConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = YAML.parse(raw);
    const targets = Array.isArray(parsed?.targets) ? parsed.targets : [];
    const enabledTargets = targets.filter((t: any) => t.enabled !== false);
    const sites = parsed?.sites ? Object.keys(parsed.sites) : [];

    return {
      configFound: true,
      hasTargets: enabledTargets.length > 0,
      enabledTargetCount: enabledTargets.length,
      siteCount: sites.length,
    };
  } catch {
    return {
      configFound: false,
      hasTargets: false,
      enabledTargetCount: 0,
      siteCount: 0,
    };
  }
}
