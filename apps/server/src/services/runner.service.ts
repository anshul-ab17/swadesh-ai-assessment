import { db } from "@test-evals/db";
import { runs, caseResults } from "@test-evals/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { hashPrompt, zeroShot, fewShot, cot } from "@test-evals/llm";
import type { PromptStrategy, FieldScores } from "@test-evals/shared";
import { Semaphore, withSemaphore } from "../lib/semaphore.js";
import { getRunEmitter, cleanupRunEmitter } from "../lib/run-events.js";
import { loadTranscriptAsync, loadGold, getTranscriptIds } from "../lib/dataset.js";
import { estimateCost } from "../lib/cost.js";
import { runExtraction } from "./extract.service.js";
import { evaluate, aggregateScores } from "./evaluate.service.js";

const STRATEGIES = { zero_shot: zeroShot, few_shot: fewShot, cot } as const;

function buildPromptHashForStrategy(strategy: PromptStrategy): string {
  const strat = STRATEGIES[strategy];
  const content = strat.SYSTEM_PROMPT + JSON.stringify(strat.buildMessages("__HASH_PLACEHOLDER__"));
  return hashPrompt(content);
}

export interface StartRunOptions {
  strategy: PromptStrategy;
  model: string;
  apiKey: string;
  datasetFilter?: string[];
  force?: boolean;
}

export async function startRun(opts: StartRunOptions): Promise<string> {
  const promptHash = buildPromptHashForStrategy(opts.strategy);
  const transcriptIds = opts.datasetFilter ?? getTranscriptIds();

  const [run] = await db.insert(runs).values({
    strategy: opts.strategy,
    model: opts.model,
    promptHash,
    status: "running",
    startedAt: new Date(),
  }).returning({ id: runs.id });

  const runId = run!.id;

  await db.insert(caseResults).values(
    transcriptIds.map((tid) => ({ runId, transcriptId: tid, status: "pending" })),
  );

  processRun(runId, transcriptIds, opts).catch(async (err: unknown) => {
    console.error(`Run ${runId} failed:`, err);
    await db.update(runs).set({ status: "failed" }).where(eq(runs.id, runId));
  });

  return runId;
}

export async function resumeRun(runId: string, apiKey: string): Promise<void> {
  const pending = await db
    .select({ transcriptId: caseResults.transcriptId })
    .from(caseResults)
    .where(and(eq(caseResults.runId, runId), inArray(caseResults.status, ["pending", "failed"])));

  const runRow = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!runRow) throw new Error(`Run ${runId} not found`);

  await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));

  const transcriptIds = pending.map((r) => r.transcriptId);
  processRun(runId, transcriptIds, {
    strategy: runRow.strategy as PromptStrategy,
    model: runRow.model,
    apiKey,
  }).catch(console.error);
}

async function processRun(
  runId: string,
  transcriptIds: string[],
  opts: { strategy: PromptStrategy; model: string; apiKey: string; force?: boolean },
): Promise<void> {
  const sem = new Semaphore(5);
  const emitter = getRunEmitter(runId);
  const start = Date.now();

  await Promise.all(
    transcriptIds.map((tid) =>
      withSemaphore(sem, () => processCase(runId, tid, opts, emitter)),
    ),
  );

  const allResults = await db.select().from(caseResults).where(eq(caseResults.runId, runId));
  const scores: FieldScores[] = allResults
    .filter((r) => r.scoreChiefComplaint !== null)
    .map((r) => ({
      chief_complaint: Number(r.scoreChiefComplaint),
      vitals: Number(r.scoreVitals),
      medications_f1: Number(r.scoreMedicationsF1),
      diagnoses_f1: Number(r.scoreDiagnosesF1),
      plan_f1: Number(r.scorePlanF1),
      follow_up: Number(r.scoreFollowUp),
    }));

  const totalTokensIn = allResults.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
  const totalTokensOut = allResults.reduce((s, r) => s + (r.tokensOut ?? 0), 0);
  const cacheRead = allResults.reduce((s, r) => s + (r.cacheReadTokens ?? 0), 0);
  const schemaFailures = allResults.filter((r) => r.schemaValid === false).length;
  const hallCount = allResults.reduce((s, r) => s + (r.hallucinationCount ?? 0), 0);
  const cost = estimateCost({ inputTokens: totalTokensIn, outputTokens: totalTokensOut, cacheReadTokens: cacheRead, cacheWriteTokens: 0 });

  await db.update(runs).set({
    status: "completed",
    completedAt: new Date(),
    totalTokensIn,
    totalTokensOut,
    cacheReadTokens: cacheRead,
    costUsd: cost.toFixed(6),
    wallMs: Date.now() - start,
    schemaFailures,
    hallucinationCount: hallCount,
  }).where(eq(runs.id, runId));

  emitter.emit("done", { runId, aggregateScores: aggregateScores(scores) });
  cleanupRunEmitter(runId);
}

async function processCase(
  runId: string,
  transcriptId: string,
  opts: { strategy: PromptStrategy; model: string; apiKey: string; force?: boolean },
  emitter: ReturnType<typeof getRunEmitter>,
): Promise<void> {
  if (!opts.force) {
    const existing = await db.query.caseResults.findFirst({
      where: and(
        eq(caseResults.runId, runId),
        eq(caseResults.transcriptId, transcriptId),
        eq(caseResults.status, "completed"),
      ),
    });
    if (existing) {
      emitter.emit("case", { runId, transcriptId, status: "skipped" });
      return;
    }
  }

  const [transcript, gold] = await Promise.all([
    loadTranscriptAsync(transcriptId),
    loadGold(transcriptId),
  ]);

  const extraction = await runExtractionWithBackoff(transcript, opts.strategy, opts.apiKey, opts.model);

  let evalResult = {
    scores: { chief_complaint: 0, vitals: 0, medications_f1: 0, diagnoses_f1: 0, plan_f1: 0, follow_up: 0 },
    hallucinationCount: 0,
  };

  if (extraction.extraction) {
    evalResult = evaluate(extraction.extraction, gold, transcript);
  }

  await db.update(caseResults).set({
    status: extraction.schemaValid ? "completed" : "failed",
    prediction: extraction.extraction as unknown as Record<string, unknown>,
    attempts: extraction.attempts as unknown as unknown[],
    schemaValid: extraction.schemaValid,
    hallucinationCount: evalResult.hallucinationCount,
    scoreChiefComplaint: evalResult.scores.chief_complaint.toFixed(4),
    scoreVitals: evalResult.scores.vitals.toFixed(4),
    scoreMedicationsF1: evalResult.scores.medications_f1.toFixed(4),
    scoreDiagnosesF1: evalResult.scores.diagnoses_f1.toFixed(4),
    scorePlanF1: evalResult.scores.plan_f1.toFixed(4),
    scoreFollowUp: evalResult.scores.follow_up.toFixed(4),
    tokensIn: extraction.usage.inputTokens,
    tokensOut: extraction.usage.outputTokens,
    cacheReadTokens: extraction.usage.cacheReadTokens,
    wallMs: extraction.wallMs,
  }).where(and(eq(caseResults.runId, runId), eq(caseResults.transcriptId, transcriptId)));

  emitter.emit("case", {
    runId,
    transcriptId,
    status: extraction.schemaValid ? "completed" : "failed",
    scores: evalResult.scores,
    hallucinationCount: evalResult.hallucinationCount,
  });
}

async function runExtractionWithBackoff(
  transcript: string,
  strategy: PromptStrategy,
  apiKey: string,
  model: string,
  maxRetries = 3,
): Promise<Awaited<ReturnType<typeof runExtraction>>> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await runExtraction(transcript, strategy, apiKey, model);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}
