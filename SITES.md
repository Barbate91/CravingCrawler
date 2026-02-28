# CravingCrawler — Sites Tracker

Track which sites we want to scrape, their status, and configuration notes.

## Active (configured & tested)

- [x] **Crumbl Cookies** — `embedded` mode, weekly rotating flavors from `__NEXT_DATA__`
  - URL: `https://crumblcookies.com/`
  - Data: title, description, image (resized WebP thumbnails)
  - Notes: Rotates every Monday. 4 items/week. Classic flavors not tracked.

- [x] **Sweet Petite Confections** — `browser` mode (Square Online, Playwright)
  - URL: `https://www.sweetpetiteconfections.com/shop/SeasonalandHoliday/16`
  - URL: `https://www.sweetpetiteconfections.com/shop/chocolatebonbons/4`
  - Data: 30 seasonal items + 9 bonbons, all with images, titles, prices
  - Notes: Seasonal URL may increment — use `auto_discover: true` if needed.

- [x] **Nothing Bundt Cakes** — `browser` mode (Magento, JS-rendered)
  - URL: `https://www.nothingbundtcakes.com/flavors`
  - Data: 12 flavors with images (includes seasonal like Banana Pudding Cake)
  - Selectors: `.flavors-item` / `.header-bold` / `.flavors-image img`

- [x] **Insomnia Cookies** — `browser` mode (React SPA, Playwright)
  - URL: `https://insomniacookies.com/menu`
  - Data: 41 menu items with images, no prices (location-dependent)
  - Selectors: `[data-ddog-id=product_card]` / `h4` / `img`

- [x] **Stella Jean's Ice Cream** — `html` mode (Squarespace, static)
  - URL: `https://www.stellajeans.com`
  - Data: 4 seasonal scoops (keyword-filtered from homepage h4 tags)
  - Selectors: `.sqs-html-content h4`

- [x] **Batch & Box** — `html` mode (Shopify, server-rendered)
  - URL: `https://www.batchandbox.com/collections/all`
  - Data: 9 products with images and prices
  - Selectors: `.product-card` / `.product-card-link` / `.product-card__price` / `.product-card__img`

## Deferred

- [ ] **Barrio Donas** — Square Online, limited scrapable content
  - URL: `https://www.barriodonas.com/menu`
  - Notes: Menu page only has 2 items (Mi Rey, Cocada). Most content is image-based. Deferred until they add more structured data.

- [ ] **Extraordinary Desserts** — WordPress landing page
  - URL: `https://extraordinarydesserts.com/`
  - Notes: Homepage has "This Week's Pre-Order" and "Today's Menu" sections but they link out to an ordering platform. No structured menu items on the page itself.

- [ ] **Sugar and Scribe** — Squarespace, no menu on site
  - URL: `https://sugarandscribe.com`
  - Notes: Landing page only — no individual menu items or specials listed.

- [ ] **An's Dry Cleaning (ADC Gelato)** — needs research
  - URL: TBD
  - Notes: Need to find correct URL and page structure.

- [ ] **Island Popper Gourmet Popcorn** — site unreachable
  - URL: TBD
  - Notes: Website was down during research. Revisit later.

- [ ] **Sidecar Donuts** — site unreachable
  - URL: `https://www.sidecardonuts.com`
  - Notes: Connection refused during research. Revisit later.
  - URL is actually `https://sidecardoughnuts.com/`

## Features

- [x] Keyword filtering — targets can specify `keywords: [...]` to keep only matching items
- [x] Auto-discover incrementing URLs — `auto_discover: true` probes trailing numbers
- [x] Image resizing with sharp — downloads, resizes to 400px WebP thumbnails
- [x] Playwright browser mode — replaced Puppeteer for JS-rendered sites
- [x] Embedded JSON extraction — `__NEXT_DATA__` for Next.js sites (Crumbl)
- [x] Pico CSS themed UI — sweet treats branding with Playfair Display + Inter fonts
