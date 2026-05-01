"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchRun, fetchCase, streamRun } from "@/lib/api";
import { ScoreCell } from "@/components/score-cell";
import type { RunDetail } from "@/lib/api";
import type { CaseResult } from "@test-evals/shared";

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [selected, setSelected] = useState<(CaseResult & { transcript: string; gold: unknown }) | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let stop: (() => void) | undefined;
    fetchRun(id).then((r) => {
      setRun(r);
      if (r.status === "running") {
        stop = streamRun(
          id,
          () => setProgress((p) => p + 1),
          () => fetchRun(id).then(setRun),
        );
      }
    });
    return () => stop?.();
  }, [id]);

  async function openCase(c: CaseResult) {
    const detail = await fetchCase(id, c.transcriptId);
    setSelected(detail);
  }

  if (!run) return <div className="p-8 text-gray-500">Loading\u2026</div>;

  const fields = ["chief_complaint", "vitals", "medications_f1", "diagnoses_f1", "plan_f1", "follow_up"] as const;
  const total = run.cases.length;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">\u2190 Runs</Link>
        <h1 className="text-xl font-bold">{run.strategy} / {run.promptHash}</h1>
        <span className={`rounded px-2 py-0.5 text-xs ${run.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{run.status}</span>
      </div>

      {run.status === "running" && (
        <div className="mb-4">
          <div className="h-2 w-full rounded bg-gray-200">
            <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${(progress / total) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">{progress}/{total} cases</p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-4 gap-4 rounded border p-4 text-sm">
        <div><span className="text-gray-500">Tokens in/out</span><br />{run.totalTokensIn}/{run.totalTokensOut}</div>
        <div><span className="text-gray-500">Cache read</span><br />{run.cacheReadTokens} ({total > 0 ? Math.round((run.cacheReadTokens / (run.totalTokensIn || 1)) * 100) : 0}%)</div>
        <div><span className="text-gray-500">Cost</span><br />${Number(run.costUsd).toFixed(6)}</div>
        <div><span className="text-gray-500">Schema fails / Hallucinations</span><br />{run.schemaFailures} / {run.hallucinationCount}</div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="py-2 pr-4">Case</th>
            {fields.map((f) => <th key={f} className="py-2 pr-4">{f.replace("_f1", "").replace("_", " ")}</th>)}
            <th className="py-2 pr-4">Hall</th>
            <th className="py-2 pr-4">Valid</th>
          </tr>
        </thead>
        <tbody>
          {run.cases.map((c) => (
            <tr key={c.transcriptId} className="cursor-pointer border-b hover:bg-gray-50" onClick={() => openCase(c)}>
              <td className="py-1.5 pr-4 font-mono text-xs text-blue-600">{c.transcriptId}</td>
              {fields.map((f) => (
                <td key={f} className="py-1.5 pr-4">
                  <ScoreCell value={(c.scores as Record<string, number>)[f] ?? null} />
                </td>
              ))}
              <td className="py-1.5 pr-4 text-xs">{c.hallucinationCount}</td>
              <td className="py-1.5 pr-4">
                <span className={`text-xs ${c.schemaValid ? "text-green-600" : "text-red-600"}`}>
                  {c.schemaValid ? "\u2713" : "\u2717"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">{selected.transcriptId}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">\u2715</button>
            </div>
            <div className="mb-4">
              <h3 className="mb-1 text-xs font-semibold text-gray-500 uppercase">Transcript</h3>
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">{selected.transcript}</pre>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="mb-1 text-xs font-semibold text-gray-500 uppercase">Gold</h3>
                <pre className="overflow-auto rounded bg-gray-50 p-3 text-xs">{JSON.stringify(selected.gold, null, 2)}</pre>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold text-gray-500 uppercase">Prediction</h3>
                <pre className="overflow-auto rounded bg-gray-50 p-3 text-xs">{JSON.stringify(selected.prediction, null, 2)}</pre>
              </div>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold text-gray-500 uppercase">Retry Trace ({(selected.attempts as unknown[]).length} attempts)</h3>
              {(selected.attempts as Array<{ attempt: number; validationErrors?: string[]; cacheReadTokens?: number }>).map((a) => (
                <div key={a.attempt} className="mb-2 rounded border p-2 text-xs">
                  <span className="font-semibold">Attempt {a.attempt}</span>
                  {a.cacheReadTokens ? <span className="ml-2 text-green-600">cache_read={a.cacheReadTokens}</span> : null}
                  {a.validationErrors && (
                    <div className="mt-1 text-red-600">
                      {a.validationErrors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
