import "dotenv/config";
import { parseArgs } from "util";
import { join } from "node:path";
import { env } from "@test-evals/env/server";
import { getTranscriptIds, loadTranscriptAsync, loadGold } from "../src/lib/dataset.js";
import { runExtraction } from "../src/services/extract.service.js";
import { evaluate, aggregateScores } from "../src/services/evaluate.service.js";
import { hashPrompt, zeroShot, fewShot, cot } from "@test-evals/llm";
import { Semaphore, withSemaphore } from "../src/lib/semaphore.js";
import { estimateCost } from "../src/lib/cost.js";
import type { PromptStrategy, FieldScores } from "@test-evals/shared";
import { mkdir, writeFile } from "node:fs/promises";

const STRATEGIES = { zero_shot: zeroShot, few_shot: fewShot, cot } as const;

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    strategy: { type: "string", default: "zero_shot" },
    model: { type: "string", default: "claude-haiku-4-5-20251001" },
  },
  allowPositionals: true,
});

const strategy = (values.strategy ?? "zero_shot") as PromptStrategy;
const model = (values.model ?? "claude-haiku-4-5-20251001") as string;

console.log(`\nHEALOSBENCH CLI — strategy=${strategy} model=${model}\n`);

const strat = STRATEGIES[strategy];
const promptHash = hashPrompt(strat.SYSTEM_PROMPT + JSON.stringify(strat.buildMessages("__HASH__")));
console.log(`Prompt hash: ${promptHash}\n`);

const transcriptIds = getTranscriptIds();
const sem = new Semaphore(5);
const allScores: FieldScores[] = [];
let totalIn = 0, totalOut = 0, totalCacheRead = 0, schemaFails = 0;
const start = Date.now();
const results: Record<string, unknown>[] = [];

await Promise.all(
  transcriptIds.map((tid) =>
    withSemaphore(sem, async () => {
      const [transcript, gold] = await Promise.all([loadTranscriptAsync(tid), loadGold(tid)]);
      const extraction = await runExtraction(transcript, strategy, env.ANTHROPIC_API_KEY, model);

      if (!extraction.extraction) {
        schemaFails++;
        process.stdout.write(`${tid} FAIL (schema invalid)\n`);
        return;
      }

      const { scores, hallucinationCount } = evaluate(extraction.extraction, gold, transcript);
      allScores.push(scores);
      totalIn += extraction.usage.inputTokens;
      totalOut += extraction.usage.outputTokens;
      totalCacheRead += extraction.usage.cacheReadTokens;

      const f1 = Object.values(scores).reduce((a, b) => a + b, 0) / 6;
      process.stdout.write(`${tid} ✓  avg_f1=${f1.toFixed(3)}  hall=${hallucinationCount}\n`);
      results.push({ transcriptId: tid, scores, hallucinationCount, attempts: extraction.attempts.length });
    }),
  ),
);

const agg = aggregateScores(allScores);
const cost = estimateCost({ inputTokens: totalIn, outputTokens: totalOut, cacheReadTokens: totalCacheRead, cacheWriteTokens: 0 });
const wallMs = Date.now() - start;

console.log(`\n${"─".repeat(60)}`);
console.log(`Strategy: ${strategy}   Model: ${model}   Hash: ${promptHash}`);
console.log(`${"─".repeat(60)}`);
console.log(`chief_complaint : ${agg.chief_complaint.toFixed(4)}`);
console.log(`vitals          : ${agg.vitals.toFixed(4)}`);
console.log(`medications_f1  : ${agg.medications_f1.toFixed(4)}`);
console.log(`diagnoses_f1    : ${agg.diagnoses_f1.toFixed(4)}`);
console.log(`plan_f1         : ${agg.plan_f1.toFixed(4)}`);
console.log(`follow_up       : ${agg.follow_up.toFixed(4)}`);
console.log(`${"─".repeat(60)}`);
console.log(`Schema failures : ${schemaFails}/${transcriptIds.length}`);
console.log(`Tokens in/out   : ${totalIn}/${totalOut}   Cache read: ${totalCacheRead}`);
console.log(`Cost            : $${cost.toFixed(6)}`);
console.log(`Wall time       : ${(wallMs / 1000).toFixed(1)}s`);
console.log(`${"─".repeat(60)}\n`);

// Save results
const resultsDir = join(import.meta.dir, "../../../results");
await mkdir(resultsDir, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const outFile = join(resultsDir, `${strategy}-${date}-${promptHash}.json`);
await writeFile(outFile, JSON.stringify({ strategy, model, promptHash, aggregateScores: agg, cases: results, cost, wallMs }, null, 2));
console.log(`Results saved to results/${strategy}-${date}-${promptHash}.json`);

if (schemaFails / transcriptIds.length > 0.1) {
  console.error("ERROR: Schema failure rate exceeds 10%");
  process.exit(1);
}
