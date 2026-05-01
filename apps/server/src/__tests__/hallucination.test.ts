import { expect, test } from "bun:test";
import { isGrounded } from "../services/evaluate.service.js";

const TRANSCRIPT = "patient has hypertension and takes lisinopril 10 mg daily blood pressure 140/90";

test("value present in transcript is grounded", () => {
  expect(isGrounded("lisinopril", TRANSCRIPT)).toBe(true);
});

test("value that matches most words is grounded", () => {
  expect(isGrounded("lisinopril 10 mg", TRANSCRIPT)).toBe(true);
});

test("value absent from transcript is not grounded", () => {
  expect(isGrounded("metformin", TRANSCRIPT)).toBe(false);
});

test("completely fabricated phrase is not grounded", () => {
  expect(isGrounded("underwent cardiac catheterization", TRANSCRIPT)).toBe(false);
});
