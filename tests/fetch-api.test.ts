import { expect, it, afterEach } from "bun:test";
import { fetchFromApi, type ApiConfig } from "../src/fetch-api.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it("fetchFromApi extracts items using dot-notation paths", async () => {
  const fakeResponse = {
    data: {
      menu: [
        { name: "Cookie Dough", cost: "$4.00", desc: "Classic flavor" },
        { name: "Birthday Cake", cost: "$4.50", desc: "Festive!" },
      ],
    },
  };

  globalThis.fetch = async () =>
    ({ ok: true, json: async () => fakeResponse, status: 200 }) as any;

  const config: ApiConfig = {
    url: "https://api.example.com/menu",
    itemsPath: "data.menu",
    titleKey: "name",
    priceKey: "cost",
    descriptionKey: "desc",
  };

  const items = await fetchFromApi(config, 1, 0);
  expect(items.length).toBe(2);
  expect(items[0].title).toBe("Cookie Dough");
  expect(items[0].price).toBe("$4.00");
  expect(items[1].title).toBe("Birthday Cake");
});

it("fetchFromApi throws if itemsPath does not resolve to an array", async () => {
  globalThis.fetch = async () =>
    ({ ok: true, json: async () => ({ data: "not an array" }), status: 200 }) as any;

  const config: ApiConfig = {
    url: "https://api.example.com/menu",
    itemsPath: "data",
    titleKey: "name",
  };

  await expect(fetchFromApi(config, 1, 0)).rejects.toThrow("did not resolve to an array");
});
