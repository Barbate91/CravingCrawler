import { load } from "cheerio";

export type Selectors = {
  item?: string; // container for each result
  title: string;
  price?: string;
};

export type Special = {
  title: string;
  price?: string | null;
  raw?: string;
};

export function parseSpecialsFromHtml(html: string, selectors: Selectors): Special[] {
  const $ = load(html);
  const items: Special[] = [];
  if (selectors.item) {
    $(selectors.item).each((_, el) => {
      const title = $(el).find(selectors.title).text().trim();
      const price = selectors.price ? $(el).find(selectors.price).text().trim() : extractPriceLike($(el).text());
      items.push({ title, price: price ?? null, raw: $(el).html() });
    });
  } else {
    // no container — try to grab all matching title nodes
    $(selectors.title).each((_, el) => {
      const title = $(el).text().trim();
      // look nearby for a price
      const parentText = $(el).parent().text();
      const price = selectors.price ? $(el).closest(selectors.price).text().trim() : extractPriceLike(parentText);
      items.push({ title, price: price ?? null, raw: $(el).parent().html() });
    });
  }
  return items;
}

function extractPriceLike(s: string): string | null {
  const m = s.match(/\$\s?\d+[.,]?\d{0,2}/);
  return m ? m[0] : null;
}
