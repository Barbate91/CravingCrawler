import { readFile } from "fs/promises";
import { parseSpecialsFromHtml } from "../src/parse.js";
import { expect, it } from "bun:test";

it("parses titles and prices from crumbl fixture", async () => {
  const html = await readFile(new URL("./fixtures/crumbl.html", import.meta.url), "utf8");
  const selectors = { item: ".product-card", title: ".product-title", price: ".product-price" };
  const items = parseSpecialsFromHtml(html, selectors);
  expect(items.length).toBe(2);
  expect(items[0].title).toBe("Chocolate Chip");
  expect(items[0].price).toBe("$3.50");
  expect(items[1].title).toBe("Sugar Cookie");
});
