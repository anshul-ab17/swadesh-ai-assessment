"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchRun, fetchRuns } from "@/lib/api";
import { ScoreCell, DeltaCell } from "@/components/score-cell";
import type { RunDetail } from "@/lib/api";
import type { RunRecord } from "@test-evals/shared";

const FIELDS = [
  { key: "chief_complaint", label: "Chief Complaint" },
  { key: "vitals", label: "Vitals" },
  { key: "medications_f1", label: "Medications F1" },
  { key: "diagnoses_f1", label: "Diagnoses F1" },
  { key: "plan_f1", label: "Plan F1" },
  { key: "follow_up", label: "Follow-Up" },
] as const;

export default function ComparePage() {
  const params = useSearchParams();
  const aId = params.get("a") ?? "";
  const bId = params.get("b") ?? "";
  const [runA, setRunA] = useState<RunDetail | null>(null);
  const [runB, setRunB] = useState<RunDetail | null>(null);
  const [allRuns, setAllRuns] = useState<RunRecord[]>([]);
  const [selA, setSelA] = useState(aId);
  const [selB, setSelB] = useState(bId);

  useEffect(() => {
    fetchRuns().then(setAllRuns);
  }, []);

  useEffect(() => {
    if (selA) fetchRun(selA).then(setRunA);
    if (selB) fetchRun(selB).then(setRunB);
  }, [selA, selB]);

  const aggA = runA?.aggregateScores;
  const aggB = runB?.aggregateScores;

  const bWinsCount = aggA && aggB
    ? FIELDS.filter((f) => (aggB[f.key] ?? 0) > (aggA[f.key] ?? 0)).length
    : 0;
  const aWinsCount = aggA && aggB
    ? FIELDS.filter((f) => (aggA[f.key] ?? 0) > (aggB[f.key] ?? 0)).length
    : 0;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">\u2190 Runs</Link>
        <h1 className="text-xl font-bold">Compare Runs</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        {[{ label: "Run A", sel: selA, setSel: setSelA, run: runA }, { label: "Run B", sel: selB, setSel: setSelB, run: runB }].map(({ label, sel, setSel, run }) => (
          <div key={label} className="rounded border p-4">
            <div className="mb-2 text-sm font-semibold text-gray-600">{label}</div>
            <select value={sel} onChange={(e) => setSel(e.target.value)} className="w-full rounded border px-2 py-1 text-sm mb-2">
              <option value="">Select run\u2026</option>
              {allRuns.map((r) => (
                <option key={r.id} value={r.id}>{r.strategy} \u2014 {r.promptHash} \u2014 {r.status}</option>
              ))}
            </select>
            {run && (
              <div className="text-xs text-gray-500">
                <div>Strategy: <span className="font-mono">{run.strategy}</span></div>
                <div>Hash: <span className="font-mono">{run.promptHash}</span></div>
                <div>Cost: ${Number(run.costUsd).toFixed(6)}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {aggA && aggB && (
        <>
          <div className="mb-4 rounded bg-blue-50 p-3 text-sm">
            <span className="font-semibold">
              {aWinsCount > bWinsCount
                ? `Run A (${runA?.strategy}) wins on ${aWinsCount}/6 fields`
                : bWinsCount > aWinsCount
                  ? `Run B (${runB?.strategy}) wins on ${bWinsCount}/6 fields`
                  : "Tie \u2014 each wins on the same number of fields"}
            </span>
          </div>

          <table className="w-full border-collapse text-sm mb-8">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 pr-4">Field</th>
                <th className="py-2 pr-4">Run A ({runA?.strategy})</th>
                <th className="py-2 pr-4">Run B ({runB?.strategy})</th>
                <th className="py-2 pr-4">Delta (B\u2212A)</th>
                <th className="py-2 pr-4">Winner</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(({ key, label }) => {
                const va = aggA[key] ?? 0;
                const vb = aggB[key] ?? 0;
                const winner = vb > va + 0.005 ? "B" : va > vb + 0.005 ? "A" : "\u2014";
                return (
                  <tr key={key} className="border-b">
                    <td className="py-2 pr-4 font-medium">{label}</td>
                    <td className="py-2 pr-4"><ScoreCell value={va} /></td>
                    <td className="py-2 pr-4"><ScoreCell value={vb} /></td>
                    <td className="py-2 pr-4"><DeltaCell a={va} b={vb} /></td>
                    <td className="py-2 pr-4 font-semibold">{winner}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {runA && runB && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Per-Case Breakdown</h2>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-1 pr-3">Case</th>
                    <th className="py-1 pr-3">Avg F1 (A)</th>
                    <th className="py-1 pr-3">Avg F1 (B)</th>
                    <th className="py-1 pr-3">\u0394</th>
                    <th className="py-1 pr-3">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {runA.cases.map((ca) => {
                    const cb = runB.cases.find((c) => c.transcriptId === ca.transcriptId);
                    const avgA = Object.values(ca.scores as Record<string, number>).reduce((s, v) => s + v, 0) / 6;
                    const avgB = cb ? Object.values(cb.scores as Record<string, number>).reduce((s, v) => s + v, 0) / 6 : 0;
                    const delta = avgB - avgA;
                    return (
                      <tr key={ca.transcriptId} className="border-b">
                        <td className="py-1 pr-3 font-mono">{ca.transcriptId}</td>
                        <td className="py-1 pr-3"><ScoreCell value={avgA} /></td>
                        <td className="py-1 pr-3"><ScoreCell value={avgB} /></td>
                        <td className="py-1 pr-3"><DeltaCell a={avgA} b={avgB} /></td>
                        <td className="py-1 pr-3 text-xs">
                          {delta > 0.05 ? <span className="text-green-600">improved</span> :
                           delta < -0.05 ? <span className="text-red-600">regressed</span> :
                           <span className="text-gray-400">same</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
