# CravingCrawler

Track limited-time treats from your favorite shops. One Bun app — web dashboard + background scraper in a single process.

## Quick start

```bash
bun install
bun run dev        # → http://localhost:4321 (dashboard + scraper loop)
```

That's it. The scraper runs in the background on the interval defined in `config.yml`. The web dashboard reads fresh data on every request.

## How it works

`bun run dev` starts an Astro SSR server (powered by Bun) with a custom integration that runs the scraper loop in-process. One command, one process.

```
CravingCrawler/
├── config.yml              ← single config: sites, targets, schedules, notifications
├── astro.config.mjs        ← Astro config (registers scraper integration)
├── src/
│   ├── pages/              ← Astro pages (index + per-site detail)
│   ├── layouts/            ← Astro layouts (Pico CSS)
│   ├── lib/                ← web data loaders
│   ├── integrations/       ← scraper Astro integration (in-process loop)
│   ├── scheduler.ts        ← scraper core: fetch, diff, notify, persist
│   ├── config.ts           ← unified config.yml loader
│   ├── fetch.ts            ← plain HTTP fetch (html mode)
│   ├── fetch-browser.ts    ← Puppeteer headless fetch (browser mode)
│   ├── fetch-api.ts        ← JSON API fetch (api mode)
│   ├── parse.ts            ← Cheerio HTML parser
│   ├── diff.ts             ← change detection (new / removed items)
│   ├── notify.ts           ← Discord webhook + bot DM
│   └── cli.ts              ← single-URL ad-hoc scraper
├── data/                   ← scraper writes JSON here, web reads it
├── Dockerfile
├── docker-compose.yml
└── tests/
```

## Scripts

| Command | What it does |
|---------|-------------|
| `bun run dev` | Start dashboard + scraper (dev mode, hot reload) |
| `bun run start` | Build + run for production |
| `bun test` | Run all tests |
| `bun run schedule` | Standalone single-pass scrape (for cron/CI) |
| `bun run schedule:loop` | Standalone scraper loop (no web server) |
| `bun run scrape` | Ad-hoc single-URL CLI scraper |

## Configuration — `config.yml`

Everything is in one file. Environment variable interpolation is supported via `${VAR_NAME}` syntax.

```yaml
settings:
  interval_minutes: 60        # how often the scraper loops
  rate_limit_seconds: 5        # pause between HTTP requests

notifications:
  enabled: true
  discord_webhook_url: "${DISCORD_WEBHOOK_URL}"

sites:
  crumbl:
    type: html                 # html | browser | api
    selectors:
      item: ".product-card"
      title: ".product-title"
      price: ".product-price"

targets:
  - site: crumbl
    url: "https://crumblcookies.com/menu"
    region: us-default
    enabled: true
```

## Fetch modes

| Mode | `type` | When to use | Requires |
|------|--------|-------------|----------|
| **HTML** | `html` (default) | Server-rendered pages | Nothing extra |
| **Browser** | `browser` | JS-rendered SPAs | `puppeteer` (optional dep) |
| **API** | `api` | Sites with a JSON API | Nothing extra |

### Browser mode example

```yaml
sites:
  fancy-cookies:
    type: browser
    selectors:
      item: ".menu-card"
      title: ".card-title"
      price: ".card-price"
    browser:
      waitForSelector: ".menu-card"
      timeout: 20000
```

### API mode example

```yaml
sites:
  some-bakery:
    type: api
    api:
      url: "https://api.somebakery.com/v1/specials"
      itemsPath: "data.items"
      titleKey: "name"
      priceKey: "price"
      descriptionKey: "description"
```

## Change detection

The scheduler diffs each run against the most recent saved data. Notifications only fire for **new** or **removed** items.

- 🆕 New items → "new item" notification
- ⏳ Removed items → "leaving soon" notification
- `--notify-all` overrides this to report everything

## Docker

Single container — dashboard + scraper in one process.

```bash
docker compose up -d
# → http://localhost:4321
```

Config is bind-mounted from `./config.yml`. Data persists in a Docker volume.

```bash
docker compose logs -f        # view logs
docker compose up -d --build  # rebuild after code changes
```

Set `WEB_PORT` in your environment to change the port (default 4321).

## Environment variables

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications |
| `DISCORD_BOT_TOKEN` | Discord bot token (alternative to webhook) |
| `DISCORD_TARGET_USER_ID` | Target user for bot DMs |
| `RATE_LIMIT_SECONDS` | Override rate limit (overrides config.yml) |
| `DATA_DIR` | Data directory (default: `./data`) |
| `CONFIG_PATH` | Path to config.yml (default: `./config.yml`) |
| `WEB_PORT` | Dashboard port in Docker (default: 4321) |

## CI / GitHub Actions

`.github/workflows/scheduled.yml` runs daily at 09:00 UTC as a headless alternative. Uses `bun run schedule --notify` and posts to Discord.
