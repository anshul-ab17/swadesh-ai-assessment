import { pgTable, text, integer, boolean, jsonb, uuid, numeric, unique } from "drizzle-orm/pg-core";
import { runs } from "./runs.js";

export const caseResults = pgTable(
  "case_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    transcriptId: text("transcript_id").notNull(),
    status: text("status").notNull().default("pending"),
    prediction: jsonb("prediction"),
    attempts: jsonb("attempts").default([]),
    schemaValid: boolean("schema_valid"),
    hallucinationCount: integer("hallucination_count").default(0),
    scoreChiefComplaint: numeric("score_chief_complaint", { precision: 5, scale: 4 }),
    scoreVitals: numeric("score_vitals", { precision: 5, scale: 4 }),
    scoreMedicationsF1: numeric("score_medications_f1", { precision: 5, scale: 4 }),
    scoreDiagnosesF1: numeric("score_diagnoses_f1", { precision: 5, scale: 4 }),
    scorePlanF1: numeric("score_plan_f1", { precision: 5, scale: 4 }),
    scoreFollowUp: numeric("score_follow_up", { precision: 5, scale: 4 }),
    tokensIn: integer("tokens_in").default(0),
    tokensOut: integer("tokens_out").default(0),
    cacheReadTokens: integer("cache_read_tokens").default(0),
    wallMs: integer("wall_ms").default(0),
  },
  (t) => [unique("unique_run_transcript").on(t.runId, t.transcriptId)],
);

export type CaseResultRow = typeof caseResults.$inferSelect;
export type NewCaseResult = typeof caseResults.$inferInsert;
