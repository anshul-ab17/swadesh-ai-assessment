import { extractClinical, ExtractionError } from "@test-evals/llm";
import type { ExtractionResult as LLMExtractionResult } from "@test-evals/llm";
import type { PromptStrategy, AttemptLog, ClinicalExtraction } from "@test-evals/shared";
import type { LLMUsage } from "@test-evals/llm";

export interface ServiceExtractionResult {
  extraction: ClinicalExtraction | null;
  attempts: AttemptLog[];
  usage: LLMUsage;
  schemaValid: boolean;
  wallMs: number;
}

export async function runExtraction(
  transcript: string,
  strategy: PromptStrategy,
  apiKey: string,
  model: string,
): Promise<ServiceExtractionResult> {
  const start = Date.now();
  try {
    const result: LLMExtractionResult = await extractClinical(transcript, strategy, apiKey, model);
    return {
      extraction: result.extraction,
      attempts: result.attempts,
      usage: result.usage,
      schemaValid: true,
      wallMs: Date.now() - start,
    };
  } catch (err) {
    if (err instanceof ExtractionError) {
      return {
        extraction: null,
        attempts: err.attempts,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        schemaValid: false,
        wallMs: Date.now() - start,
      };
    }
    throw err;
  }
}
