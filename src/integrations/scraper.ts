import type { AstroIntegration } from "astro";
import path from "path";
import { loadConfig } from "../config.js";

/**
 * Astro integration that runs the scraper loop as a subprocess.
 * On server start, it loads config.yml and begins periodic scraping.
 * Each tick spawns `bun src/scheduler.ts` as a child process, so
 * playwright/sharp/discord.js memory is freed when the subprocess exits.
 * On server stop, it cancels the loop.
 */
export default function scraperIntegration(): AstroIntegration {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  return {
    name: "cravingcrawler-scraper",
    hooks: {
      "astro:server:start": async () => {
        running = true;
        const configPath = process.env.CONFIG_PATH ?? path.resolve(process.cwd(), "config.yml");
        const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");

        async function tick() {
          if (!running) return;
          const startTime = Date.now();
          let intervalMs = 60 * 60 * 1000; // default 1 hour

          try {
            const config = await loadConfig(configPath);
            intervalMs = (config.settings.interval_minutes ?? 60) * 60 * 1000;

            if (config.targets.length === 0) {
              console.log("[scraper] No targets configured, sleeping...");
            } else {
              const args = [
                "src/scheduler.ts",
                "--config", configPath,
                "--data-dir", dataDir,
              ];
              if (config.notifications.enabled) {
                args.push("--notify");
              }

              const proc = Bun.spawn(["bun", ...args], {
                stdout: "inherit",
                stderr: "inherit",
              });

              await proc.exited;
              console.log(`[scraper] Subprocess exited with code ${proc.exitCode}`);
            }
          } catch (err) {
            console.error("[scraper] Error:", err);
          }

          if (!running) return;
          const elapsed = Date.now() - startTime;
          const sleepMs = Math.max(10_000, intervalMs - elapsed);
          console.log(`[scraper] Next run in ${Math.round(sleepMs / 60000)} minutes`);
          timer = setTimeout(tick, sleepMs);
        }

        console.log("[scraper] Starting background scraper loop...");
        // Small delay so the server finishes starting before the first scrape
        timer = setTimeout(tick, 2000);
      },

      "astro:server:stop": () => {
        console.log("[scraper] Stopping background scraper...");
        running = false;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
    },
  };
}
