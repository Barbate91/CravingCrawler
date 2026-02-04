# CravingCrawler
Scraper for dessert specials

Quick start (local)

- Install Bun: https://bun.sh
- Install deps: `bun install`
- Run CLI: `bun run src/cli.ts --url https://example.com --site crumbl`
- Run tests: `bun test`

Project layout (important files)

- `src/` — core scraper logic (fetch / parse / output)
- `config/sites/` — site-specific selectors (YAML)
- `tests/` — unit + fixture-driven integration tests

Goals

- Config-driven selectors per site
- Small, pure parser functions for easy unit testing
- Conservative default rate limits and retries

Discord notifications

- The CLI can send a Discord DM (bot) or post to a webhook when new items are found.
- Provide `DISCORD_BOT_TOKEN` + `DISCORD_TARGET_USER_ID` in your environment, or set `DISCORD_WEBHOOK_URL`.
- Example:

  bun run src/cli.ts --url https://example.com/specials --site crumbl --notify --discord-user 1234567890

- For CI/automation, prefer webhooks to avoid storing bot tokens in CI secrets.

Scheduling (daily runs) 📅

- Add targets to `config/targets.yml`. Each entry points to a `config/sites/<site>.yml` selector set and a URL.
- Local run: `bun run src/scheduler.ts --notify` (or `bun run schedule` via npm script).
- CI: the repository provides `.github/workflows/scheduled.yml` which runs daily at 09:00 UTC and uses `DISCORD_WEBHOOK_URL` from secrets.

Example `config/targets.yml` entry:

```yaml
- site: crumbl
  url: "https://www.crumblcookies.com/locations/today"
  enabled: true
  schedule: "daily@09:00"
```

- The scheduler writes results to `data/<site>/<region>/<YYYY-MM-DD>.json` when items are found.
