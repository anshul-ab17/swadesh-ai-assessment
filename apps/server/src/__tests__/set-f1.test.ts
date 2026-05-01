import { expect, test } from "bun:test";
import { evaluate } from "../services/evaluate.service.js";
import type { ClinicalExtraction } from "@test-evals/shared";

const BASE: ClinicalExtraction = {
  chief_complaint: "chest pain",
  vitals: { bp: "120/80", hr: 72, temp_f: 98.6, spo2: 99 },
  medications: [{ name: "aspirin", dose: "81 mg", frequency: "daily", route: "PO" }],
  diagnoses: [{ description: "stable angina" }],
  plan: ["EKG", "stress test", "follow up cardiology"],
  follow_up: { interval_days: 30, reason: "cardiology review" },
};

test("perfect match gives F1=1 for medications", () => {
  const result = evaluate(BASE, BASE, "chest pain aspirin 81 mg daily EKG stress test cardiology 30");
  expect(result.scores.medications_f1).toBeCloseTo(1, 2);
});

test("empty prediction vs non-empty gold gives F1=0", () => {
  const pred = { ...BASE, medications: [] };
  const result = evaluate(pred, BASE, "chest pain");
  expect(result.scores.medications_f1).toBe(0);
});

test("partial match gives intermediate F1 for plan", () => {
  const pred = { ...BASE, plan: ["EKG"] };
  const result = evaluate(pred, BASE, "EKG stress test follow up cardiology chest pain");
  // precision=1, recall=1/3, f1=0.5
  expect(result.scores.plan_f1).toBeCloseTo(0.5, 1);
});

test("both empty gives F1=1", () => {
  const pred = { ...BASE, medications: [] };
  const gold = { ...BASE, medications: [] };
  const result = evaluate(pred, gold, "chest pain");
  expect(result.scores.medications_f1).toBe(1);
});
