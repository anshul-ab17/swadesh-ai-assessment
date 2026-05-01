export function ScoreCell({ value }: { value: number | string | null }) {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  const pct = Math.round(n * 100);
  const color = pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600";
  return <span className={`font-mono text-sm ${color}`}>{pct}%</span>;
}

export function DeltaCell({ a, b }: { a: number | string | null; b: number | string | null }) {
  const na = typeof a === "string" ? parseFloat(a) : (a ?? 0);
  const nb = typeof b === "string" ? parseFloat(b) : (b ?? 0);
  const delta = nb - na;
  const sign = delta >= 0 ? "+" : "";
  const color = delta > 0.01 ? "text-green-600" : delta < -0.01 ? "text-red-600" : "text-gray-500";
  return <span className={`font-mono text-sm ${color}`}>{sign}{Math.round(delta * 100)}%</span>;
}
