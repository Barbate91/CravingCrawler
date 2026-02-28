import { expect, it } from "bun:test";
import { generateHtml, type SiteSummary } from "../src/static-page.js";

it("generateHtml produces valid HTML with site data", () => {
  const summaries: SiteSummary[] = [
    {
      site: "crumbl",
      region: "us-west",
      date: "2025-01-15",
      items: [
        { title: "Chocolate Chip", price: "$3.50" },
        { title: "Sugar Cookie", price: "$3.00", description: "Classic sugar cookie" },
      ],
    },
  ];

  const html = generateHtml(summaries, new Date("2025-01-15T12:00:00Z"));

  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("CravingCrawler");
  expect(html).toContain("Chocolate Chip");
  expect(html).toContain("$3.50");
  expect(html).toContain("Sugar Cookie");
  expect(html).toContain("Classic sugar cookie");
  expect(html).toContain("crumbl");
  expect(html).toContain("us-west");
});

it("generateHtml escapes HTML entities", () => {
  const summaries: SiteSummary[] = [
    {
      site: "test",
      region: "default",
      date: "2025-01-15",
      items: [{ title: "<script>alert('xss')</script>", price: "$0" }],
    },
  ];

  const html = generateHtml(summaries);
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
});

it("generateHtml handles empty summaries", () => {
  const html = generateHtml([]);
  expect(html).toContain("No data yet");
});
