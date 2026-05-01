import { expect, test, mock } from "bun:test";
import { extractClinical } from "@test-evals/llm";

const VALID_OUTPUT = {
  chief_complaint: "cough",
  vitals: { bp: "120/80", hr: 70, temp_f: 98.6, spo2: 98 },
  medications: [],
  diagnoses: [{ description: "bronchitis" }],
  plan: ["rest"],
  follow_up: { interval_days: 7, reason: "follow up" },
};

test("retry loop feeds validation errors back and succeeds on second attempt", async () => {
  let callCount = 0;
  const mockCreate = mock(async () => {
    callCount++;
    if (callCount === 1) {
      return {
        content: [{ type: "tool_use", name: "extract_clinical_data", input: { chief_complaint: "cough" } }],
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        stop_reason: "tool_use",
      };
    }
    return {
      content: [{ type: "tool_use", name: "extract_clinical_data", input: VALID_OUTPUT }],
      usage: { input_tokens: 120, output_tokens: 60, cache_read_input_tokens: 10, cache_creation_input_tokens: 0 },
      stop_reason: "tool_use",
    };
  });

  const result = await extractClinical(
    "patient has cough",
    "zero_shot",
    "test-key",
    "claude-haiku-4-5-20251001",
    mockCreate as unknown as Parameters<typeof extractClinical>[4],
  );

  expect(result.attempts).toHaveLength(2);
  expect(result.attempts[0]!.validationErrors).toBeDefined();
  expect(result.attempts[1]!.validationErrors).toBeUndefined();
  expect(result.extraction.chief_complaint).toBe("cough");
});
