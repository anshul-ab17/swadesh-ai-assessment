import { expect, test } from "bun:test";
import { db } from "@test-evals/db";
import { runs, caseResults } from "@test-evals/db/schema";
import { eq, and, inArray } from "drizzle-orm";

test("resume only processes pending and failed cases", async () => {
  const [run] = await db.insert(runs).values({
    strategy: "zero_shot",
    model: "claude-haiku-4-5-20251001",
    promptHash: "testhash002",
    status: "running",
  }).returning({ id: runs.id });

  const runId = run!.id;

  await db.insert(caseResults).values([
    { runId, transcriptId: "case_001", status: "completed" },
    { runId, transcriptId: "case_002", status: "completed" },
    { runId, transcriptId: "case_003", status: "completed" },
    { runId, transcriptId: "case_004", status: "pending" },
    { runId, transcriptId: "case_005", status: "failed" },
  ]);

  const pending = await db
    .select({ transcriptId: caseResults.transcriptId })
    .from(caseResults)
    .where(and(eq(caseResults.runId, runId), inArray(caseResults.status, ["pending", "failed"])));

  expect(pending).toHaveLength(2);
  expect(pending.map((r) => r.transcriptId).sort()).toEqual(["case_004", "case_005"]);

  await db.delete(runs).where(eq(runs.id, runId));
});
