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

- [x] **Island Popper Gourmet Popcorn** — `browser` mode (Square Online, Playwright)
  - URL: `https://www.islandpopper.com/featured-flavor`
  - Data: featured flavor of the month with images, titles, prices
  - Selectors: `.product-group` / `.w-product-title` / `.figure__image img`

- [x] **Sidecar Doughnuts** — `browser` mode (WordPress, sectionScript)
  - URL: `https://sidecardoughnuts.com/menu/`
  - Data: seasonal doughnut flavors with images
  - Selectors: `.product-card` / `h4` / `picture[data-src]`
  - Notes: Uses sectionScript to extract only the "Seasonal flavors" section.

- [x] **Baskin-Robbins** — `browser` mode (sectionScript; CSS background-image extraction)
  - URL: `https://www.baskinrobbins.com/en/flavor-of-the-month`
  - Data: single Flavor of the Month — title, description, image
  - Notes: Image is a CSS `background-image`; sectionScript normalizes it to `<img>`. Targets only the FOM hero, not the "Perfect Match" grid of permanent flavors.

- [x] **Cold Stone Creamery** — `html` mode (server-rendered)
  - URL: `https://www.coldstonecreamery.com/icecream/signaturecreations/index.html`
  - Data: first 3 signature creations (seasonal) — title, image, link
  - Selectors: `ul.parentLanding li` / `.ctabtn` / `img`
  - Notes: Grid lists all signature creations; only first 3 are seasonal. Uses `max_items: 3`.

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


## Features

- [x] Keyword filtering — targets can specify `keywords: [...]` to keep only matching items
- [x] Auto-discover incrementing URLs — `auto_discover: true` probes trailing numbers
- [x] Image resizing with sharp — downloads, resizes to 400px WebP thumbnails
- [x] Playwright browser mode — replaced Puppeteer for JS-rendered sites
- [x] Embedded JSON extraction — `__NEXT_DATA__` for Next.js sites (Crumbl)
- [x] Pico CSS themed UI — sweet treats branding with Playfair Display + Inter fonts
