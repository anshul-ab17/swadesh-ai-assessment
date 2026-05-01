import type { ClinicalExtraction } from "./schema.js";

export type PromptStrategy = "zero_shot" | "few_shot" | "cot";

export interface AttemptLog {
  attempt: number;
  messages: unknown[];
  response: unknown;
  validationErrors?: string[];
  cacheReadTokens?: number;
}

export interface FieldScores {
  chief_complaint: number;
  vitals: number;
  medications_f1: number;
  diagnoses_f1: number;
  plan_f1: number;
  follow_up: number;
}

export interface CaseResult {
  id: string;
  runId: string;
  transcriptId: string;
  status: "pending" | "completed" | "failed" | "skipped";
  prediction: ClinicalExtraction | null;
  attempts: AttemptLog[];
  schemaValid: boolean;
  hallucinationCount: number;
  scores: FieldScores;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  wallMs: number;
}

export interface RunRecord {
  id: string;
  strategy: PromptStrategy;
  model: string;
  promptHash: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  totalTokensIn: number;
  totalTokensOut: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Fixed-decimal string (e.g. "0.004231") — Drizzle ORM returns numeric columns as strings */
  costUsd: string;
  wallMs: number;
  schemaFailures: number;
  hallucinationCount: number;
  aggregateScores?: FieldScores;
}

export interface RunSummary extends RunRecord {
  cases: CaseResult[];
}

export interface SSEEvent {
  runId: string;
  transcriptId: string;
  status: "completed" | "failed";
  scores: FieldScores;
  hallucinationCount: number;
}
