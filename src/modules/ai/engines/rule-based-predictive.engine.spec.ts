import { RuleBasedPredictiveEngine } from './rule-based-predictive.engine';
import { WeightSample } from '@core/ai/predictive-engine.interface';

const DAY = 1000 * 60 * 60 * 24;

/** Builds a strictly-linear weight series: weight = base + gainPerDay * day. */
function linearSeries(base: number, gainPerDay: number, days: number[]): WeightSample[] {
  const t0 = new Date('2025-01-01T00:00:00.000Z').getTime();
  return days.map((d) => ({
    weightKg: base + gainPerDay * d,
    measuredAt: new Date(t0 + d * DAY),
  }));
}

describe('RuleBasedPredictiveEngine', () => {
  let engine: RuleBasedPredictiveEngine;

  beforeEach(() => {
    engine = new RuleBasedPredictiveEngine();
  });

  it('computes the Average Daily Gain (GDP) exactly for a linear series', async () => {
    // 100kg growing 1.0 kg/day, sampled at days 0, 10, 20.
    const result = await engine.projectWeight({
      animalId: 'a1',
      samples: linearSeries(100, 1.0, [0, 10, 20]),
      horizonsInDays: [30, 60, 90],
    });

    expect(result.averageDailyGainKg).toBe(1);
    expect(result.engine).toBe('rule-based-linear-v1');
    // Perfect fit => high-ish confidence (R^2=1, nudged by sample count).
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects a different slope (0.75 kg/day)', async () => {
    const result = await engine.projectWeight({
      animalId: 'a2',
      samples: linearSeries(50, 0.75, [0, 8, 16, 24]),
      horizonsInDays: [30],
    });
    expect(result.averageDailyGainKg).toBe(0.75);
  });

  it('projects monotonically increasing weights spaced by GDP * horizon delta', async () => {
    const gain = 1.2;
    const result = await engine.projectWeight({
      animalId: 'a3',
      samples: linearSeries(80, gain, [0, 15, 30]),
      horizonsInDays: [30, 60, 90],
    });

    const [p30, p60, p90] = result.projections.map((p) => p.projectedWeightKg);
    expect(p60).toBeGreaterThan(p30);
    expect(p90).toBeGreaterThan(p60);
    // Difference between consecutive 30-day horizons must equal GDP * 30.
    expect(p60 - p30).toBeCloseTo(gain * 30, 1);
    expect(p90 - p60).toBeCloseTo(gain * 30, 1);
  });

  it('degrades gracefully with a single sample (no gain, low confidence)', async () => {
    const result = await engine.projectWeight({
      animalId: 'a4',
      samples: linearSeries(120, 0, [5]),
      horizonsInDays: [30],
    });
    expect(result.averageDailyGainKg).toBe(0);
    expect(result.confidence).toBeLessThan(0.2);
  });

  it('handles an empty series without throwing', async () => {
    const result = await engine.projectWeight({
      animalId: 'a5',
      samples: [],
      horizonsInDays: [30, 60],
    });
    expect(result.averageDailyGainKg).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.projections).toHaveLength(2);
    expect(result.projections.every((p) => p.projectedWeightKg >= 0)).toBe(true);
  });

  it('never projects a negative weight even with a steep negative slope', async () => {
    const result = await engine.projectWeight({
      animalId: 'a6',
      samples: linearSeries(100, -5, [0, 5, 10]),
      horizonsInDays: [90],
    });
    expect(result.projections[0].projectedWeightKg).toBeGreaterThanOrEqual(0);
  });
});
