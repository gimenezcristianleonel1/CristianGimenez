import { Injectable } from '@nestjs/common';
import {
  PredictiveEngine,
  ProjectedWeight,
  WeightProjectionInput,
  WeightProjectionResult,
} from '@core/ai/predictive-engine.interface';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * MVP PredictiveEngine: deterministic, rule/statistics based.
 *
 * Estimates Average Daily Gain (ADG / GDP) with an ordinary least-squares
 * linear regression over the weight time-series, then projects future weight
 * at the requested horizons. When data is too sparse it degrades gracefully to
 * a two-point slope or a flat projection.
 *
 * This class is bound to the PREDICTIVE_ENGINE token; replacing it with a
 * Scikit-Learn/TensorFlow or LLM-backed engine requires no consumer changes.
 */
@Injectable()
export class RuleBasedPredictiveEngine implements PredictiveEngine {
  readonly name = 'rule-based-linear-v1';

  async projectWeight(input: WeightProjectionInput): Promise<WeightProjectionResult> {
    const samples = [...input.samples].sort(
      (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
    );

    const { adgKg, confidence, anchorWeight, anchorTime } = this.estimate(samples);

    const projections: ProjectedWeight[] = input.horizonsInDays.map((horizon) => {
      const daysFromAnchor = (Date.now() - anchorTime) / MS_PER_DAY + horizon;
      const projected = anchorWeight + adgKg * daysFromAnchor;
      return {
        horizonInDays: horizon,
        // Weight cannot be negative; round to 2 decimals.
        projectedWeightKg: Math.round(Math.max(projected, 0) * 100) / 100,
      };
    });

    return {
      animalId: input.animalId,
      averageDailyGainKg: Math.round(adgKg * 1000) / 1000,
      projections,
      confidence,
      engine: this.name,
    };
  }

  /**
   * Ordinary least-squares slope (kg/day) of weight vs. time.
   * Returns the slope plus an anchor (latest sample) used for projection.
   */
  private estimate(samples: WeightProjectionInput['samples']): {
    adgKg: number;
    confidence: number;
    anchorWeight: number;
    anchorTime: number;
  } {
    if (samples.length === 0) {
      return { adgKg: 0, confidence: 0, anchorWeight: 0, anchorTime: Date.now() };
    }

    const last = samples[samples.length - 1];
    if (samples.length === 1) {
      return {
        adgKg: 0,
        confidence: 0.1,
        anchorWeight: last.weightKg,
        anchorTime: last.measuredAt.getTime(),
      };
    }

    // Convert timestamps to days relative to the first sample for numerical stability.
    const t0 = samples[0].measuredAt.getTime();
    const xs = samples.map((s) => (s.measuredAt.getTime() - t0) / MS_PER_DAY);
    const ys = samples.map((s) => s.weightKg);
    const n = samples.length;

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - meanX) * (ys[i] - meanY);
      sxx += (xs[i] - meanX) ** 2;
    }

    // All measurements at the same instant: fall back to flat slope.
    if (sxx === 0) {
      return { adgKg: 0, confidence: 0.1, anchorWeight: last.weightKg, anchorTime: last.measuredAt.getTime() };
    }

    const slope = sxy / sxx;

    // Confidence ~ R^2, nudged up with sample count (heuristic for the MVP).
    const r2 = this.rSquared(xs, ys, slope, meanX, meanY);
    const sampleFactor = Math.min(n / 6, 1);
    const confidence = Math.round(Math.min(r2 * sampleFactor + 0.05, 0.99) * 100) / 100;

    return {
      adgKg: slope,
      confidence,
      anchorWeight: last.weightKg,
      anchorTime: last.measuredAt.getTime(),
    };
  }

  private rSquared(
    xs: number[],
    ys: number[],
    slope: number,
    meanX: number,
    meanY: number,
  ): number {
    const intercept = meanY - slope * meanX;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < xs.length; i++) {
      const predicted = slope * xs[i] + intercept;
      ssRes += (ys[i] - predicted) ** 2;
      ssTot += (ys[i] - meanY) ** 2;
    }
    if (ssTot === 0) {
      return 0;
    }
    return Math.max(0, 1 - ssRes / ssTot);
  }
}
