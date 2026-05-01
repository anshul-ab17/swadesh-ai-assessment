import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db } from "@test-evals/db";
import { runs, caseResults } from "@test-evals/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { env } from "@test-evals/env/server";
import { startRun, resumeRun } from "../services/runner.service.js";
import { getRunEmitter } from "../lib/run-events.js";
import { loadTranscriptAsync, loadGold } from "../lib/dataset.js";
import { aggregateScores } from "../services/evaluate.service.js";
import type { PromptStrategy } from "@test-evals/shared";

export const runsRouter = new Hono();

runsRouter.post("/", async (c) => {
  const body = await c.req.json<{ strategy: PromptStrategy; model?: string; dataset_filter?: string[]; force?: boolean }>();
  const runId = await startRun({
    strategy: body.strategy,
    model: body.model ?? "claude-haiku-4-5-20251001",
    apiKey: env.ANTHROPIC_API_KEY,
    datasetFilter: body.dataset_filter,
    force: body.force,
  });
  return c.json({ runId });
});

runsRouter.get("/", async (c) => {
  const allRuns = await db.select().from(runs).orderBy(desc(runs.startedAt));
  return c.json(allRuns);
});

runsRouter.get("/:id", async (c) => {
  const runId = c.req.param("id");
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run) return c.json({ error: "Not found" }, 404);

  const cases = await db.select().from(caseResults).where(eq(caseResults.runId, runId));
  const scores = cases
    .filter((r) => r.scoreChiefComplaint !== null)
    .map((r) => ({
      chief_complaint: Number(r.scoreChiefComplaint),
      vitals: Number(r.scoreVitals),
      medications_f1: Number(r.scoreMedicationsF1),
      diagnoses_f1: Number(r.scoreDiagnosesF1),
      plan_f1: Number(r.scorePlanF1),
      follow_up: Number(r.scoreFollowUp),
    }));

  return c.json({ ...run, cases, aggregateScores: aggregateScores(scores) });
});

runsRouter.get("/:id/stream", (c) => {
  const runId = c.req.param("id");
  const emitter = getRunEmitter(runId);
  return streamSSE(c, async (stream) => {
    await new Promise<void>((resolve) => {
      emitter.on("case", async (data: unknown) => {
        await stream.writeSSE({ event: "case", data: JSON.stringify(data) });
      });
      emitter.once("done", async () => {
        await stream.writeSSE({ event: "done", data: JSON.stringify({ done: true }) });
        resolve();
      });
      // Timeout after 10 min
      setTimeout(resolve, 600_000);
    });
  });
});

runsRouter.post("/:id/resume", async (c) => {
  const runId = c.req.param("id");
  await resumeRun(runId, env.ANTHROPIC_API_KEY);
  return c.json({ resumed: true });
});

runsRouter.get("/:id/cases/:cid", async (c) => {
  const { id: runId, cid: transcriptId } = c.req.param();
  const caseRow = await db.query.caseResults.findFirst({
    where: and(eq(caseResults.runId, runId), eq(caseResults.transcriptId, transcriptId)),
  });
  if (!caseRow) return c.json({ error: "Not found" }, 404);

  const [transcript, gold] = await Promise.all([
    loadTranscriptAsync(transcriptId),
    loadGold(transcriptId),
  ]);

  return c.json({ ...caseRow, transcript, gold });
});
