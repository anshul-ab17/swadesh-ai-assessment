import { join } from "node:path";
import type { ClinicalExtraction } from "@test-evals/shared";

const DATA_DIR = join(import.meta.dir, "../../../../data");

export function getTranscriptIds(): string[] {
  const ids: string[] = [];
  for (let i = 1; i <= 50; i++) {
    ids.push(`case_${String(i).padStart(3, "0")}`);
  }
  return ids;
}

export async function loadTranscriptAsync(transcriptId: string): Promise<string> {
  return Bun.file(join(DATA_DIR, "transcripts", `${transcriptId}.txt`)).text();
}

export async function loadGold(transcriptId: string): Promise<ClinicalExtraction> {
  const text = await Bun.file(join(DATA_DIR, "gold", `${transcriptId}.json`)).text();
  return JSON.parse(text) as ClinicalExtraction;
}
