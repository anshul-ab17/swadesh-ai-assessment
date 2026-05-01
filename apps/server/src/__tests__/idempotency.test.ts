import { expect, test } from "bun:test";
import { db } from "@test-evals/db";
import { runs, caseResults } from "@test-evals/db/schema";
import { eq, and } from "drizzle-orm";

test("completed case is skipped on second run without force", async () => {
  const [run] = await db.insert(runs).values({
    strategy: "zero_shot",
    model: "claude-haiku-4-5-20251001",
    promptHash: "testhash001",
    status: "completed",
  }).returning({ id: runs.id });

  const runId = run!.id;
  await db.insert(caseResults).values({
    runId,
    transcriptId: "case_001",
    status: "completed",
    schemaValid: true,
    scoreChiefComplaint: "0.9500",
    scoreVitals: "1.0000",
    scoreMedicationsF1: "0.8000",
    scoreDiagnosesF1: "1.0000",
    scorePlanF1: "0.7500",
    scoreFollowUp: "1.0000",
  });

  const existing = await db.query.caseResults.findFirst({
    where: and(
      eq(caseResults.runId, runId),
      eq(caseResults.transcriptId, "case_001"),
      eq(caseResults.status, "completed"),
    ),
  });

  expect(existing).toBeDefined();
  expect(existing!.schemaValid).toBe(true);

  await db.delete(runs).where(eq(runs.id, runId));
});
