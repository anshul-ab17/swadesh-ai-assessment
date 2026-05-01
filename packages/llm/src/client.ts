import Anthropic from "@anthropic-ai/sdk";

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export function extractUsage(usage: Anthropic.Usage): LLMUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: (usage as Record<string, number>)["cache_read_input_tokens"] ?? 0,
    cacheWriteTokens: (usage as Record<string, number>)["cache_creation_input_tokens"] ?? 0,
  };
}
