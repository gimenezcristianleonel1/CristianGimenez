import type { WeightRow } from './types';

const DAY = 86_400_000;

/**
 * Average Daily Gain (kg/day) via ordinary least-squares over the weight
 * series. Mirrors the backend engine so the field user sees the same metric
 * even while offline. Returns null when there is not enough data.
 */
export function averageDailyGain(weights: WeightRow[]): number | null {
  if (weights.length < 2) return null;
  const sorted = [...weights].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  );
  const t0 = new Date(sorted[0].measuredAt).getTime();
  const xs = sorted.map((w) => (new Date(w.measuredAt).getTime() - t0) / DAY);
  const ys = sorted.map((w) => Number(w.weightKg));
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
    sxx += (xs[i] - meanX) ** 2;
  }
  if (sxx === 0) return 0;
  return Math.round((sxy / sxx) * 1000) / 1000;
}
