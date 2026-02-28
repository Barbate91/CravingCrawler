import { expect, it } from "bun:test";
import { findNewItems, findRemovedItems } from "../src/diff.js";
import type { Special } from "../src/parse.js";

const prev: Special[] = [
  { title: "Chocolate Chip", price: "$3.50" },
  { title: "Sugar Cookie", price: "$3.00" },
  { title: "Peanut Butter", price: "$4.00" },
];

const curr: Special[] = [
  { title: "Chocolate Chip", price: "$3.50" },
  { title: "Sugar Cookie", price: "$3.25" }, // price changed, same title
  { title: "Red Velvet", price: "$4.50" },   // new
];

it("findNewItems returns only items with titles not in previous", () => {
  const result = findNewItems(prev, curr);
  expect(result.length).toBe(1);
  expect(result[0].title).toBe("Red Velvet");
});

it("findRemovedItems returns items no longer present", () => {
  const result = findRemovedItems(prev, curr);
  expect(result.length).toBe(1);
  expect(result[0].title).toBe("Peanut Butter");
});

it("findNewItems treats everything as new when previous is empty", () => {
  const result = findNewItems([], curr);
  expect(result.length).toBe(curr.length);
});

it("findNewItems is case-insensitive", () => {
  const prev2: Special[] = [{ title: "CHOCOLATE CHIP", price: "$3.50" }];
  const curr2: Special[] = [{ title: "chocolate chip", price: "$3.50" }];
  expect(findNewItems(prev2, curr2).length).toBe(0);
});
