import type Anthropic from "@anthropic-ai/sdk";
export { SYSTEM_PROMPT, getSystemBlocks } from "./zero-shot.js";

const COT_INSTRUCTIONS = `Before populating the tool, reason through each field:
1. CHIEF COMPLAINT: What did the patient say was their main reason for the visit?
2. VITALS: What BP/HR/Temp/SpO2 values appear in the transcript header or dialogue?
3. MEDICATIONS: List every drug mentioned with dose, frequency, and route. Use null for missing fields.
4. DIAGNOSES: What diagnosis/diagnoses did the doctor state? Include ICD-10 only if the code is inferable.
5. PLAN: List each discrete action item the doctor ordered or recommended.
6. FOLLOW_UP: When should the patient return and why? Use null if not specified.

Think through each field step by step, then call the extract_clinical_data tool.`;

export function buildMessages(transcript: string): Anthropic.MessageParam[] {
  return [
    {
      role: "user",
      content: `${COT_INSTRUCTIONS}\n\nTranscript:\n\n${transcript}`,
    },
  ];
}
