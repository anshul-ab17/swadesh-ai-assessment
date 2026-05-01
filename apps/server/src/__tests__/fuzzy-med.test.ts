import { expect, test } from "bun:test";
import { evaluate } from "../services/evaluate.service.js";
import type { ClinicalExtraction } from "@test-evals/shared";

const BASE: ClinicalExtraction = {
  chief_complaint: "hypertension",
  vitals: { bp: null, hr: null, temp_f: null, spo2: null },
  diagnoses: [],
  plan: [],
  follow_up: { interval_days: null, reason: null },
  medications: [],
};

function makeExtraction(meds: ClinicalExtraction["medications"]): ClinicalExtraction {
  return { ...BASE, medications: meds };
}

test("BID matches twice daily", () => {
  const pred = makeExtraction([{ name: "metformin", dose: "500 mg", frequency: "BID", route: "PO" }]);
  const gold = makeExtraction([{ name: "metformin", dose: "500 mg", frequency: "twice daily", route: "PO" }]);
  const result = evaluate(pred, gold, "metformin 500 mg BID twice daily");
  expect(result.scores.medications_f1).toBeCloseTo(1, 1);
});

test("10mg matches 10 mg", () => {
  const pred = makeExtraction([{ name: "lisinopril", dose: "10mg", frequency: "daily", route: "PO" }]);
  const gold = makeExtraction([{ name: "lisinopril", dose: "10 mg", frequency: "daily", route: "PO" }]);
  const result = evaluate(pred, gold, "lisinopril 10mg daily");
  expect(result.scores.medications_f1).toBeCloseTo(1, 1);
});

test("different drug names below threshold gives F1=0", () => {
  const pred = makeExtraction([{ name: "aspirin", dose: "81 mg", frequency: "daily", route: "PO" }]);
  const gold = makeExtraction([{ name: "warfarin", dose: "5 mg", frequency: "daily", route: "PO" }]);
  const result = evaluate(pred, gold, "aspirin 81mg warfarin 5mg");
  expect(result.scores.medications_f1).toBe(0);
});
