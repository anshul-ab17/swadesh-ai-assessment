import { env } from "@test-evals/env/web";
import type { RunRecord, CaseResult, FieldScores } from "@test-evals/shared";

export type RunDetail = RunRecord & { cases: CaseResult[]; aggregateScores: FieldScores };

const base = () => env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8787";

export async function fetchRuns(): Promise<RunRecord[]> {
  const res = await fetch(`${base()}/api/v1/runs`);
  return res.json() as Promise<RunRecord[]>;
}

export async function fetchRun(id: string): Promise<RunDetail> {
  const res = await fetch(`${base()}/api/v1/runs/${id}`);
  return res.json() as Promise<RunDetail>;
}

export async function fetchCase(runId: string, transcriptId: string): Promise<CaseResult & { transcript: string; gold: unknown }> {
  const res = await fetch(`${base()}/api/v1/runs/${runId}/cases/${transcriptId}`);
  return res.json() as Promise<CaseResult & { transcript: string; gold: unknown }>;
}

export async function startRun(opts: { strategy: string; model?: string }): Promise<{ runId: string }> {
  const res = await fetch(`${base()}/api/v1/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return res.json() as Promise<{ runId: string }>;
}

export function streamRun(runId: string, onEvent: (data: unknown) => void, onDone: () => void): () => void {
  const es = new EventSource(`${base()}/api/v1/runs/${runId}/stream`);
  es.addEventListener("case", (e) => {
    onEvent(JSON.parse(e.data as string));
  });
  es.addEventListener("done", () => {
    onDone();
    es.close();
  });
  return () => es.close();
}
