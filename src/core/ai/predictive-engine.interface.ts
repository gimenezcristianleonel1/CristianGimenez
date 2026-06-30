/**
 * ============================================================
 *  PredictiveEngine - AI Extensibility Seam (Pattern D)
 * ------------------------------------------------------------
 *  Clean abstraction over any predictive capability of the system.
 *
 *  In the MVP we ship a deterministic, rule/linear-regression based
 *  implementation. When we later plug in Scikit-Learn / TensorFlow models,
 *  LLM embeddings or an external inference service, we ONLY swap the class
 *  bound to `PREDICTIVE_ENGINE` — every consumer keeps working untouched.
 * ============================================================
 */

/** Injection token used to resolve the active PredictiveEngine implementation. */
export const PREDICTIVE_ENGINE = Symbol('PREDICTIVE_ENGINE');

/** A single weight observation in the animal's time-series. */
export interface WeightSample {
  readonly weightKg: number;
  readonly measuredAt: Date;
}

/** Input contract for a weight projection request. */
export interface WeightProjectionInput {
  readonly animalId: string;
  /** Chronological weight history (oldest -> newest). */
  readonly samples: ReadonlyArray<WeightSample>;
  /** Breed code, allowing breed-specific growth curves later on. */
  readonly breed?: string;
  /** Horizons (in days) to project forward, e.g. [30, 60, 90]. */
  readonly horizonsInDays: ReadonlyArray<number>;
}

/** A single projected data point. */
export interface ProjectedWeight {
  readonly horizonInDays: number;
  readonly projectedWeightKg: number;
}

/** Output contract for a weight projection. */
export interface WeightProjectionResult {
  readonly animalId: string;
  /** Average Daily Gain (kg/day) estimated from the history. */
  readonly averageDailyGainKg: number;
  readonly projections: ReadonlyArray<ProjectedWeight>;
  /** Confidence in [0,1]; rule-based MVP reports a heuristic value. */
  readonly confidence: number;
  /** Identifier of the engine that produced the result (audit/AI lineage). */
  readonly engine: string;
}

/**
 * The contract every predictive engine (rule-based, statistical, ML, LLM)
 * must satisfy.
 */
export interface PredictiveEngine {
  /** Project an animal's future weight at the requested horizons. */
  projectWeight(input: WeightProjectionInput): Promise<WeightProjectionResult>;
}
