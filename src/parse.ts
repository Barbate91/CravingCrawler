import { load } from "cheerio";

export type Selectors = {
  item?: string; // container for each result
  title: string;
  price?: string;
  image?: string; // selector for an <img> element (extracts src or data-src attribute)
  link?: string;  // selector for a link element (extracts href attribute)
  description?: string; // selector for inline description
};

export type Special = {
  title: string;
  price?: string | null;
  description?: string;
  image?: string;
  link?: string;
  raw?: string;
};

/** Extract the best image URL from an element (tries src, then data-src, then srcset first entry) */
function extractImageUrl($el: ReturnType<ReturnType<typeof load>>): string | undefined {
  return $el.attr("src") || $el.attr("data-src") || $el.attr("srcset")?.split(/[,\s]+/)?.[0] || undefined;
}

export function parseSpecialsFromHtml(html: string, selectors: Selectors): Special[] {
  const $ = load(html);
  const items: Special[] = [];
  if (selectors.item) {
    $(selectors.item).each((_, el) => {
      const title = $(el).find(selectors.title).text().trim();
      if (!title) return;
      const price = selectors.price ? $(el).find(selectors.price).text().trim() : extractPriceLike($(el).text());
      const image = selectors.image ? extractImageUrl($(el).find(selectors.image).first()) : undefined;
      const link = selectors.link ? ($(el).find(selectors.link).attr("href") ?? undefined) : undefined;
      const description = selectors.description ? ($(el).find(selectors.description).text().trim() || undefined) : undefined;
      items.push({ title, price: price ?? null, image, link, description, raw: $(el).html() ?? undefined });
    });
  } else if (!selectors.item && selectors.image) {
    // Zip-mode: collect titles and images separately, pair by index
    // Used when images are in sibling blocks, not ancestors (e.g. Stella Jean's)
    const titles: string[] = [];
    $(selectors.title).each((_, el) => {
      const t = $(el).text().trim();
      if (t) titles.push(t);
    });
    const images: string[] = [];
    $(selectors.image).each((_, el) => {
      const url = extractImageUrl($(el));
      if (url) images.push(url);
    });
    for (let i = 0; i < titles.length; i++) {
      items.push({ title: titles[i], price: null, image: images[i] ?? undefined });
    }
  } else {
    // no container, no image — find title nodes, then walk up ancestors to locate price
    $(selectors.title).each((_, el) => {
      const title = $(el).text().trim();
      if (!title) return;

      // Walk up to 10 ancestor levels to find a common parent with price/image
      let ancestor = $(el).parent();
      let price: string | null = null;
      let image: string | undefined;

      for (let depth = 0; depth < 10; depth++) {
        if (!ancestor.length) break;
        if (!price && selectors.price) {
          const priceEl = ancestor.find(selectors.price).first();
          if (priceEl.length) price = priceEl.text().trim();
        }
        if (!image && selectors.image) {
          const imgEl = ancestor.find(selectors.image).first();
          if (imgEl.length) image = extractImageUrl(imgEl);
        }
        if ((price || !selectors.price) && (image || !selectors.image)) break;
        ancestor = ancestor.parent();
      }

      if (!price && !selectors.price) {
        price = extractPriceLike($(el).parent().text());
      }

      items.push({ title, price: price ?? null, image, raw: $(el).parent().html() ?? undefined });
    });
  }
  return items;
}

function extractPriceLike(s: string): string | null {
  const m = s.match(/\$\s?\d+[.,]?\d{0,2}/);
  return m ? m[0] : null;
}
