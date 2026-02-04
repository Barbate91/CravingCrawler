#!/usr/bin/env bun

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import YAML from "yaml";
import { readFile } from "fs/promises";

import { fetchHtml } from "./fetch.js";
import { parseSpecialsFromHtml } from "./parse.js";
import { toJson, writeJsonToPath } from "./output.js";
import { sendDiscordMessageFromEnv, sendDiscordWebhook, sendDiscordDmUsingClient } from "./notify.js";

const argv = await yargs(hideBin(process.argv))
  .option("url", { type: "string", description: "URL to scrape" })
  .option("site", { type: "string", description: "site key from config/sites" })
  .option("config", { type: "string", description: "path to YAML config (overrides site)" })
  .option("out", { type: "string", description: "write JSON to path instead of stdout" })
  .option("notify", { type: "boolean", description: "send a Discord notification if items found", default: false })
  .option("discord-webhook", { type: "string", description: "send notification via Discord webhook (overrides bot)" })
  .option("discord-user", { type: "string", description: "target Discord user ID for DM (overrides DISCORD_TARGET_USER_ID)" })
  .demandOption(["url"])
  .help()
  .parse();

async function loadSiteConfig(site?: string, configPath?: string) {
  if (configPath) {
    const raw = await readFile(configPath, "utf8");
    return YAML.parse(raw);
  }
  if (site) {
    const raw = await readFile(new URL(`../config/sites/${site}.yml`, import.meta.url), "utf8");
    return YAML.parse(raw);
  }
  return null;
}

async function main() {
  const siteCfg = await loadSiteConfig(argv.site as string | undefined, argv.config as string | undefined);
  const selectors = siteCfg?.selectors ?? { title: "h1" };
  const html = await fetchHtml(argv.url as string);
  const items = parseSpecialsFromHtml(html, selectors);
  if (argv.out) {
    await writeJsonToPath(items, argv.out as string);
    console.log(`Wrote ${items.length} items to ${argv.out}`);
  } else {
    console.log(toJson(items));
  }

  if (argv.notify) {
    const short = items.map((i: any) => `${i.title}${i.price ? ` — ${i.price}` : ""}`).slice(0, 5).join("\n");
    const message = `CravingCrawler found ${items.length} item(s):\n${short}`;
    try {
      if (argv['discord-webhook']) {
        await sendDiscordWebhook(argv['discord-webhook'] as string, message);
        console.log("Notification sent via webhook");
      } else {
        // prefer env or CLI-provided user id
        const targetUser = (argv['discord-user'] as string) || process.env.DISCORD_TARGET_USER_ID;
        if (!targetUser) throw new Error("no target user id provided (DISCORD_TARGET_USER_ID or --discord-user)");
        await sendDiscordMessageFromEnv(message, { targetUser });
        console.log("Notification sent via Discord bot");
      }
    } catch (err) {
      console.warn("Failed to send notification:", err);
    }
  }
  return;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
