import type Anthropic from "@anthropic-ai/sdk";

export const SYSTEM_PROMPT = `You are a clinical documentation assistant. Extract structured data from doctor-patient encounter transcripts exactly as instructed. Only extract information explicitly stated in the transcript. Use null for any field not mentioned.`;

export function getSystemBlocks(): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      // @ts-expect-error cache_control is valid but not yet in SDK types
      cache_control: { type: "ephemeral" },
    },
  ];
}

export function buildMessages(transcript: string): Anthropic.MessageParam[] {
  return [
    {
      role: "user",
      content: `Extract all clinical data from this transcript:\n\n${transcript}`,
    },
  ];
}
