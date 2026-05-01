import type { ClinicalExtraction, Medication, FieldScores } from "@test-evals/shared";

// ── Fuzzy matching ─────────────────────────────────────────────────────────

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigrams.get(bg) ?? 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersect++;
    }
  }
  return (2 * intersect) / (a.length + b.length - 2);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyScore(a: string, b: string): number {
  return diceCoefficient(normalize(a), normalize(b));
}

// ── Medication normalization ───────────────────────────────────────────────

const FREQ_MAP: Record<string, string> = {
  bid: "twice daily",
  "twice a day": "twice daily",
  "2x daily": "twice daily",
  tid: "three times daily",
  "three times a day": "three times daily",
  qd: "daily",
  "once daily": "daily",
  "once a day": "daily",
  qid: "four times daily",
  "four times a day": "four times daily",
  prn: "as needed",
};

function normDose(dose: string | null): string {
  if (!dose) return "";
  return dose.toLowerCase().replace(/(\d)\s*(mg|ml|mcg|g|%)/gi, "$1 $2").replace(/\s+/g, " ").trim();
}

function normFreq(freq: string | null): string {
  if (!freq) return "";
  const lower = freq.toLowerCase().trim();
  return FREQ_MAP[lower] ?? lower;
}

// ── Set F1 ─────────────────────────────────────────────────────────────────

function setF1<T>(predicted: T[], gold: T[], matchFn: (a: T, b: T) => boolean): number {
  if (predicted.length === 0 && gold.length === 0) return 1;
  if (predicted.length === 0 || gold.length === 0) return 0;
  const matched = new Set<number>();
  let tp = 0;
  for (const p of predicted) {
    for (let i = 0; i < gold.length; i++) {
      if (!matched.has(i) && matchFn(p, gold[i]!)) {
        tp++;
        matched.add(i);
        break;
      }
    }
  }
  const precision = tp / predicted.length;
  const recall = tp / gold.length;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

// ── Field scorers ──────────────────────────────────────────────────────────

function scoreChiefComplaint(pred: string, gold: string): number {
  return fuzzyScore(pred, gold);
}

function scoreVitals(pred: ClinicalExtraction["vitals"], gold: ClinicalExtraction["vitals"]): number {
  const bpMatch = pred.bp === gold.bp ? 1 : 0;
  const hrMatch = pred.hr === gold.hr ? 1 : 0;
  const tempMatch =
    pred.temp_f === null && gold.temp_f === null
      ? 1
      : pred.temp_f !== null && gold.temp_f !== null && Math.abs(pred.temp_f - gold.temp_f) <= 0.2
        ? 1
        : 0;
  const spo2Match = pred.spo2 === gold.spo2 ? 1 : 0;
  return (bpMatch + hrMatch + tempMatch + spo2Match) / 4;
}

function medMatch(a: Medication, b: Medication): boolean {
  const nameSim = fuzzyScore(a.name, b.name);
  if (nameSim < 0.7) return false;
  const doseMatch = !a.dose || !b.dose || normDose(a.dose) === normDose(b.dose);
  const freqMatch = !a.frequency || !b.frequency || normFreq(a.frequency) === normFreq(b.frequency);
  return doseMatch && freqMatch;
}

function scoreMedications(pred: ClinicalExtraction["medications"], gold: ClinicalExtraction["medications"]): number {
  return setF1(pred, gold, medMatch);
}

function scoreDiagnoses(pred: ClinicalExtraction["diagnoses"], gold: ClinicalExtraction["diagnoses"]): number {
  return setF1(pred, gold, (a, b) => fuzzyScore(a.description, b.description) >= 0.6);
}

function scorePlan(pred: string[], gold: string[]): number {
  return setF1(pred, gold, (a, b) => fuzzyScore(a, b) >= 0.6);
}

function scoreFollowUp(pred: ClinicalExtraction["follow_up"], gold: ClinicalExtraction["follow_up"]): number {
  const daysMatch = pred.interval_days === gold.interval_days ? 1 : 0;
  const reasonScore =
    pred.reason === null && gold.reason === null
      ? 1
      : pred.reason !== null && gold.reason !== null
        ? fuzzyScore(pred.reason, gold.reason)
        : 0;
  return (daysMatch + reasonScore) / 2;
}

// ── Hallucination detection ────────────────────────────────────────────────

export function isGrounded(value: string, transcript: string): boolean {
  const normVal = normalize(value);
  const normTranscript = normalize(transcript);
  if (normTranscript.includes(normVal)) return true;
  const valWords = normVal.split(" ").filter(Boolean);
  const transcriptWords = new Set(normTranscript.split(" "));
  if (valWords.length === 0) return true;
  const matchCount = valWords.filter((w) => transcriptWords.has(w)).length;
  return matchCount / valWords.length >= 0.7;
}

function countHallucinations(pred: ClinicalExtraction, transcript: string): number {
  let count = 0;
  if (!isGrounded(pred.chief_complaint, transcript)) count++;
  for (const med of pred.medications) {
    if (!isGrounded(med.name, transcript)) count++;
  }
  for (const dx of pred.diagnoses) {
    if (!isGrounded(dx.description, transcript)) count++;
  }
  for (const item of pred.plan) {
    if (!isGrounded(item, transcript)) count++;
  }
  if (pred.follow_up.reason && !isGrounded(pred.follow_up.reason, transcript)) count++;
  return count;
}

// ── Main evaluate function ─────────────────────────────────────────────────

export interface EvaluationResult {
  scores: FieldScores;
  hallucinationCount: number;
}

export function evaluate(
  prediction: ClinicalExtraction,
  gold: ClinicalExtraction,
  transcript: string,
): EvaluationResult {
  const scores: FieldScores = {
    chief_complaint: scoreChiefComplaint(prediction.chief_complaint, gold.chief_complaint),
    vitals: scoreVitals(prediction.vitals, gold.vitals),
    medications_f1: scoreMedications(prediction.medications, gold.medications),
    diagnoses_f1: scoreDiagnoses(prediction.diagnoses, gold.diagnoses),
    plan_f1: scorePlan(prediction.plan, gold.plan),
    follow_up: scoreFollowUp(prediction.follow_up, gold.follow_up),
  };
  return { scores, hallucinationCount: countHallucinations(prediction, transcript) };
}

export function aggregateScores(results: FieldScores[]): FieldScores {
  if (results.length === 0) {
    return { chief_complaint: 0, vitals: 0, medications_f1: 0, diagnoses_f1: 0, plan_f1: 0, follow_up: 0 };
  }
  const sum = results.reduce(
    (acc, s) => ({
      chief_complaint: acc.chief_complaint + s.chief_complaint,
      vitals: acc.vitals + s.vitals,
      medications_f1: acc.medications_f1 + s.medications_f1,
      diagnoses_f1: acc.diagnoses_f1 + s.diagnoses_f1,
      plan_f1: acc.plan_f1 + s.plan_f1,
      follow_up: acc.follow_up + s.follow_up,
    }),
    { chief_complaint: 0, vitals: 0, medications_f1: 0, diagnoses_f1: 0, plan_f1: 0, follow_up: 0 },
  );
  const n = results.length;
  return {
    chief_complaint: sum.chief_complaint / n,
    vitals: sum.vitals / n,
    medications_f1: sum.medications_f1 / n,
    diagnoses_f1: sum.diagnoses_f1 / n,
    plan_f1: sum.plan_f1 / n,
    follow_up: sum.follow_up / n,
  };
}
