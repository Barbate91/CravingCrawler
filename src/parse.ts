import { load } from "cheerio";

export type Selectors = {
  item?: string; // container for each result
  title: string;
  price?: string;
  image?: string; // selector for an <img> element (extracts src attribute)
};

export type Special = {
  title: string;
  price?: string | null;
  description?: string;
  image?: string;
  raw?: string;
};

export function parseSpecialsFromHtml(html: string, selectors: Selectors): Special[] {
  const $ = load(html);
  const items: Special[] = [];
  if (selectors.item) {
    $(selectors.item).each((_, el) => {
      const title = $(el).find(selectors.title).text().trim();
      if (!title) return;
      const price = selectors.price ? $(el).find(selectors.price).text().trim() : extractPriceLike($(el).text());
      const image = selectors.image ? ($(el).find(selectors.image).attr("src") ?? undefined) : undefined;
      items.push({ title, price: price ?? null, image, raw: $(el).html() });
    });
  } else {
    // no container — find title nodes, then walk up ancestors to locate price & image
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
          if (imgEl.length) image = imgEl.attr("src") ?? undefined;
        }
        if ((price || !selectors.price) && (image || !selectors.image)) break;
        ancestor = ancestor.parent();
      }

      if (!price && !selectors.price) {
        price = extractPriceLike($(el).parent().text());
      }

      items.push({ title, price: price ?? null, image, raw: $(el).parent().html() });
    });
  }
  return items;
}

function extractPriceLike(s: string): string | null {
  const m = s.match(/\$\s?\d+[.,]?\d{0,2}/);
  return m ? m[0] : null;
}
