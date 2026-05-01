import Anthropic from "@anthropic-ai/sdk";
import { ClinicalExtractionSchema, type ClinicalExtraction } from "@test-evals/shared";
import type { AttemptLog, PromptStrategy } from "@test-evals/shared";
import { createClient, extractUsage, type LLMUsage } from "./client.js";
import * as zeroShot from "./strategies/zero-shot.js";
import * as fewShot from "./strategies/few-shot.js";
import * as cot from "./strategies/cot.js";

const STRATEGIES = { zero_shot: zeroShot, few_shot: fewShot, cot } as const;

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "extract_clinical_data",
  description: "Extract structured clinical data from a doctor-patient transcript.",
  input_schema: {
    type: "object",
    properties: {
      chief_complaint: { type: "string" },
      vitals: {
        type: "object",
        properties: {
          bp: { type: ["string", "null"] },
          hr: { type: ["integer", "null"] },
          temp_f: { type: ["number", "null"] },
          spo2: { type: ["integer", "null"] },
        },
        required: ["bp", "hr", "temp_f", "spo2"],
        additionalProperties: false,
      },
      medications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            dose: { type: ["string", "null"] },
            frequency: { type: ["string", "null"] },
            route: { type: ["string", "null"] },
          },
          required: ["name", "dose", "frequency", "route"],
          additionalProperties: false,
        },
      },
      diagnoses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            icd10: { type: "string" },
          },
          required: ["description"],
          additionalProperties: false,
        },
      },
      plan: { type: "array", items: { type: "string" } },
      follow_up: {
        type: "object",
        properties: {
          interval_days: { type: ["integer", "null"] },
          reason: { type: ["string", "null"] },
        },
        required: ["interval_days", "reason"],
        additionalProperties: false,
      },
    },
    required: ["chief_complaint", "vitals", "medications", "diagnoses", "plan", "follow_up"],
    additionalProperties: false,
  },
};

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly attempts: AttemptLog[],
  ) {
    super(message);
  }
}

export interface ExtractionResult {
  extraction: ClinicalExtraction;
  attempts: AttemptLog[];
  usage: LLMUsage;
}

export async function extractClinical(
  transcript: string,
  strategy: PromptStrategy,
  apiKey: string,
  model = "claude-haiku-4-5-20251001",
  createFn?: (params: unknown) => Promise<unknown>,
): Promise<ExtractionResult> {
  const client = createClient(apiKey);
  const strat = STRATEGIES[strategy];
  const systemBlocks = strat.getSystemBlocks();
  const attempts: AttemptLog[] = [];
  let messages = strat.buildMessages(transcript);
  let totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const callParams = {
      model,
      max_tokens: 1024,
      system: systemBlocks as Anthropic.TextBlockParam[],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool" as const, name: "extract_clinical_data" },
      messages,
    };

    const rawResponse = createFn
      ? await createFn(callParams)
      : await client.messages.create(callParams);
    const response = rawResponse as Anthropic.Message;

    const usage = extractUsage(response.usage);
    totalUsage = {
      inputTokens: totalUsage.inputTokens + usage.inputTokens,
      outputTokens: totalUsage.outputTokens + usage.outputTokens,
      cacheReadTokens: totalUsage.cacheReadTokens + usage.cacheReadTokens,
      cacheWriteTokens: totalUsage.cacheWriteTokens + usage.cacheWriteTokens,
    };

    const toolUse = response.content.find((b) => b.type === "tool_use");
    const rawInput = toolUse?.type === "tool_use" ? toolUse.input : null;

    const parsed = ClinicalExtractionSchema.safeParse(rawInput);

    const log: AttemptLog = {
      attempt,
      messages: messages as unknown[],
      response: response.content,
      validationErrors: parsed.success
        ? undefined
        : parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      cacheReadTokens: usage.cacheReadTokens,
    };
    attempts.push(log);

    if (parsed.success) {
      return { extraction: parsed.data, attempts, usage: totalUsage };
    }

    messages = [
      ...messages,
      { role: "assistant" as const, content: response.content },
      {
        role: "user" as const,
        content: `The extraction had validation errors. Please fix them and call the tool again:\n${log.validationErrors!.join("\n")}`,
      },
    ];
  }

  throw new ExtractionError("All 3 extraction attempts failed validation", attempts);
}
