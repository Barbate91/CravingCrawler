import { Client } from "discord.js";

export type SendFromEnvOptions = {
  targetUser?: string; // overrides DISCORD_TARGET_USER_ID
};

/**
 * Pure, testable: send DM using an existing discord.js client-like object.
 * Client must expose `users.fetch(id)` that returns an object with `send(msg)`.
 */
export async function sendDiscordDmUsingClient(client: any, userId: string, message: string) {
  const user = await client.users.fetch(userId);
  await user.send(message);
}

/** Post a message to a Discord webhook URL (no bot required). */
export async function sendDiscordWebhook(webhookUrl: string, message: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  if (!res.ok) throw new Error(`webhook failed ${res.status}`);
  return res;
}

/**
 * Convenience: create a discord.js client from env and DM the target user.
 * Reads DISCORD_BOT_TOKEN and DISCORD_TARGET_USER_ID unless overridden.
 */
export async function sendDiscordMessageFromEnv(message: string, opts: SendFromEnvOptions = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const target = opts.targetUser ?? process.env.DISCORD_TARGET_USER_ID;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  if (!target) throw new Error("DISCORD_TARGET_USER_ID is not set");
  const client = new Client({ intents: [] });
  await client.login(token);
  try {
    await sendDiscordDmUsingClient(client, target, message);
  } finally {
    client.destroy();
  }
}
