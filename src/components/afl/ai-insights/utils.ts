/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */
export const cx = (...c: Array<string | false | null | undefined>) =>
  c.filter(Boolean).join(" ");

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function mean(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

export function quantile(sortedAsc: number[], q: number) {
  if (!sortedAsc.length) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sortedAsc[base] ?? sortedAsc[0];
  const b = sortedAsc[base + 1] ?? a;
  return a + rest * (b - a);
}

export function percentileBand(values: number[], pLow = 0.25, pHigh = 0.75) {
  const v = [...values].sort((a, b) => a - b);
  return { low: quantile(v, pLow), high: quantile(v, pHigh) };
}

export function cv(values: number[]) {
  const m = mean(values);
  if (m === 0) return 0;
  return stdev(values) / Math.abs(m);
}

export function formatRange(low: number, high: number, decimals = 0) {
  const f = (n: number) => (decimals ? n.toFixed(decimals) : Math.round(n).toString());
  return `${f(low)}–${f(high)}`;
}

export function labelConfidence(score01: number) {
  // score01: higher is better
  if (score01 >= 0.82) return "Very High";
  if (score01 >= 0.68) return "High";
  if (score01 >= 0.52) return "Medium";
  return "Low";
}

export function labelVolatility(score01: number) {
  // score01: higher is more volatile
  if (score01 >= 0.75) return "Boom/Bust";
  if (score01 >= 0.55) return "Variable";
  return "Stable";
}

export function labelExplosiveness(score01: number) {
  if (score01 >= 0.75) return "Explosive";
  if (score01 >= 0.55) return "Upside";
  return "Steady";
}

export function labelConsistency(score01: number) {
  if (score01 >= 0.75) return "Very Consistent";
  if (score01 >= 0.58) return "Consistent";
  if (score01 >= 0.42) return "Mixed";
  return "Inconsistent";
}

export function normalize01(value: number, min: number, max: number) {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export function safeDiv(a: number, b: number) {
  if (!b) return 0;
  return a / b;
}

export type StatType = "fantasy" | "disposals" | "goals";

export const STAT_LABEL: Record<StatType, string> = {
  fantasy: "Fantasy",
  disposals: "Disposals",
  goals: "Goals",
};
