import { expect, test } from "bun:test";
import { hashPrompt } from "@test-evals/llm";

test("same content produces the same hash", () => {
  const h1 = hashPrompt("hello world");
  const h2 = hashPrompt("hello world");
  expect(h1).toBe(h2);
});

test("different content produces different hash", () => {
  const h1 = hashPrompt("hello world");
  const h2 = hashPrompt("hello worldX");
  expect(h1).not.toBe(h2);
});

test("hash is 12 chars hex", () => {
  const h = hashPrompt("test");
  expect(h).toMatch(/^[0-9a-f]{12}$/);
});
