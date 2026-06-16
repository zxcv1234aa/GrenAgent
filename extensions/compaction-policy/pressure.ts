export interface PressureLevel {
  level: 0 | 1 | 2 | 3;
  label: string;
}

/** Classify context pressure from usage percent (0-100), or null when unknown. */
export function classify(percent: number | null): PressureLevel {
  if (percent == null) return { level: 0, label: "ctx —" };
  const p = Math.max(0, Math.min(100, percent));
  const level = p >= 85 ? 3 : p >= 70 ? 2 : p >= 50 ? 1 : 0;
  return { level, label: `ctx ${Math.round(p)}% L${level}` };
}
