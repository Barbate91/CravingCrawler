import { expect, it, beforeEach } from "bun:test";
import { sendDiscordDmUsingClient, sendDiscordWebhook } from "../src/notify.js";

it("sendDiscordDmUsingClient calls user's send", async () => {
  let sent: string | null = null;
  const fakeClient = {
    users: {
      fetch: async (id: string) => ({ send: async (msg: string) => { sent = msg; return {}; } }),
    },
  };
  await sendDiscordDmUsingClient(fakeClient as any, "123", "hello there");
  expect(sent).toBe("hello there");
});

it("sendDiscordWebhook posts to webhook URL", async () => {
  let captured: { url: string; body: any } | null = null;
  // @ts-ignore - override global fetch for test
  globalThis.fetch = async (url: string, init: any) => {
    captured = { url, body: JSON.parse(init.body) };
    return { ok: true, status: 204 } as any;
  };
  await sendDiscordWebhook("https://example.com/webhook", "hi!");
  expect(captured).not.toBeNull();
  expect(captured!.url).toBe("https://example.com/webhook");
  expect(captured!.body.content).toBe("hi!");
});
