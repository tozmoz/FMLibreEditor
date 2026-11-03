import weights from "./rcaWeights.json";
import { judge, type Typed } from "./editDraft";
import type { EditField, FieldValues } from "./types";

// Independently transcribed conversion; positional preparation remains an estimate.
export function convertRca(
  raw: number[],
  weights: number[],
  extra = 0,
): number {
  const w = weights.map(Math.fround);
  const active = w.filter((x) => x !== 0);
  if (!active.length) throw new Error("No RCA weights");
  const threshold = (w.reduce((a, b) => a + b, 0) / active.length) * 3.75;
  let candidate = 0,
    previous = -1000;
  for (let iteration = 0; iteration <= 100; iteration++) {
    const reference =
      candidate > 0
        ? Math.fround(
            Math.fround(
              Math.fround(
                candidate - Math.min(candidate >> 2, Math.floor(extra / 3)),
              ) / 20,
            ) + 6,
          ) * 5
        : 0;
    let total = 0,
      denom = 0,
      positive = 0,
      negative = 0;
    for (let i = 0; i < raw.length; i++) {
      if (!w[i] || !raw[i]) continue;
      total += raw[i] * w[i];
      denom += w[i];
      if (candidate > 0) {
        const diff = ((raw[i] - reference) * w[i]) / 5;
        if (diff > threshold) positive += diff - threshold;
        else if (diff < -threshold) negative += -diff - threshold;
      }
    }
    if (!denom) throw new Error("No weighted attributes");
    const mean = (total + (positive - negative) * 3.75) / denom;
    if (!candidate) candidate = Math.max(1, Math.trunc((mean / 5 - 6) * 20));
    else {
      const error = reference - mean;
      const rounded = Math.trunc(error + (error < 0 ? -0.5 : 0.5));
      let step = rounded || (error > 0 ? 1 : 0);
      const reduction = Math.max(-4, -Math.floor(iteration / 10));
      step = Math.max(-5 - reduction, Math.min(step, 5 + reduction));
      if (step && previous >= -999) {
        if (Math.abs(step - previous) >= 6 && Math.abs(step) >= 2)
          step = Math.trunc(step / 2);
        if (Math.abs(previous) < Math.abs(step))
          step = Math.abs(previous) * Math.sign(step);
        if (step + previous === 0 && Math.abs(step) !== 1)
          step += step > 0 ? -1 : 1;
        if (previous > 0 && step > previous) {
          candidate--;
          continue;
        }
        if (previous < 0) step = Math.max(step, previous);
      }
      previous = step;
      if (!step) return candidate;
      candidate += step > 0 ? -1 : 1;
    }
  }
  return candidate;
}

const profiles: Record<string, string> = {
  gk: "Goalkeeper",
  dl: "FullBack",
  dr: "FullBack",
  dc: "DefenderCentral",
  wbl: "WingBack",
  wbr: "WingBack",
  dm: "DefensiveMidfielder",
  mc: "MidfielderCentral",
  ml: "WideMidfielder",
  mr: "WideMidfielder",
  amc: "AttackingMidfielderCentral",
  aml: "Winger",
  amr: "Winger",
  st: "Striker",
};
export interface RcaEstimate {
  value: number;
  position: string;
  exceedsPa: boolean;
}
export function estimateRca(
  fields: EditField[],
  start: FieldValues,
  typed: Typed,
): RcaEstimate | null {
  const values = { ...start };
  for (const field of fields) {
    if (!(field.key in start)) continue;
    const verdict = judge(field, start[field.key], typed[field.key]);
    if (
      verdict.status === "invalid" &&
      (field.key.startsWith("attribute.") ||
        field.key.startsWith("position.") ||
        field.key === "potential_ability")
    )
      return null;
    if (verdict.status === "changed") values[field.key] = verdict.edit.value;
  }
  // Explicit estimation policy: highest familiarity; stable tie order above.
  const position = Object.keys(profiles).reduce(
    (best, key) =>
      (values["position." + key] ?? 0) > (values["position." + best] ?? 0)
        ? key
        : best,
    "gk",
  );
  if ((values["position." + position] ?? 0) < 1) return null;
  const table = (weights as Record<string, Record<string, number>>)[
    profiles[position]
  ];
  const raw: number[] = [],
    w: number[] = [];
  for (const [key, weight] of Object.entries(table)) {
    const a =
      key === "weakerfoot"
        ? Math.min(
            values["attribute.left_foot"],
            values["attribute.right_foot"],
          )
        : values["attribute." + key];
    if (!Number.isFinite(a) || a < 0 || a > 100) return null;
    raw.push(a);
    w.push(weight);
  }
  const value = Math.max(1, Math.min(200, convertRca(raw, w)));
  return {
    value,
    position: position.toUpperCase(),
    exceedsPa: values.potential_ability > 0 && value > values.potential_ability,
  };
}

export function matchedRcaDraft(
  typed: Typed,
  enabled: boolean,
  rca: RcaEstimate | null,
): Typed {
  return enabled && rca
    ? { ...typed, current_ability: String(rca.value) }
    : typed;
}
