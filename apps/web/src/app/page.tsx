"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRuns, startRun } from "@/lib/api";
import { ScoreCell } from "@/components/score-cell";
import type { RunRecord } from "@test-evals/shared";

export default function RunsListPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [strategy, setStrategy] = useState<string>("zero_shot");

  useEffect(() => {
    fetchRuns().then(setRuns).finally(() => setLoading(false));
  }, []);

  async function handleStart() {
    setStarting(true);
    try {
      const { runId } = await startRun({ strategy });
      window.location.href = `/runs/${runId}`;
    } catch (err) {
      console.error("Failed to start run:", err);
      setStarting(false);
    }
  }

  const fields = ["chief_complaint", "vitals", "medications_f1", "diagnoses_f1", "plan_f1", "follow_up"] as const;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">HEALOSBENCH Runs</h1>
        <div className="flex gap-2">
          <Link href="/compare" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">Compare</Link>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="zero_shot">zero_shot</option>
            <option value="few_shot">few_shot</option>
            <option value="cot">cot</option>
          </select>
          <button
            onClick={handleStart}
            disabled={starting}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? "Starting\u2026" : "Start Run"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading\u2026</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-2 pr-4">Strategy</th>
              <th className="py-2 pr-4">Model</th>
              <th className="py-2 pr-4">Hash</th>
              <th className="py-2 pr-4">Chief</th>
              <th className="py-2 pr-4">Vitals</th>
              <th className="py-2 pr-4">Meds F1</th>
              <th className="py-2 pr-4">Dx F1</th>
              <th className="py-2 pr-4">Plan F1</th>
              <th className="py-2 pr-4">F/U</th>
              <th className="py-2 pr-4">Cost</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4">
                  <Link href={`/runs/${run.id}`} className="text-blue-600 hover:underline">
                    {run.strategy}
                  </Link>
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{run.model.split("-").slice(-2).join("-")}</td>
                <td className="py-2 pr-4 font-mono text-xs">{run.promptHash}</td>
                {fields.map((f) => (
                  <td key={f} className="py-2 pr-4">
                    <ScoreCell value={(run.aggregateScores as Record<string, number> | undefined)?.[f] ?? null} />
                  </td>
                ))}
                <td className="py-2 pr-4 font-mono text-xs">${Number(run.costUsd).toFixed(4)}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${
                    run.status === "completed" ? "bg-green-100 text-green-700" :
                    run.status === "running" ? "bg-blue-100 text-blue-700" :
                    run.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                  }`}>{run.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
