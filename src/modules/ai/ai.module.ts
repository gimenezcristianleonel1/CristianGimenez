import { Global, Module } from '@nestjs/common';
import { PREDICTIVE_ENGINE } from '@core/ai/predictive-engine.interface';
import { RuleBasedPredictiveEngine } from './engines/rule-based-predictive.engine';

/**
 * AI module. Binds the active PredictiveEngine implementation to the
 * PREDICTIVE_ENGINE token. Global so any feature module can consume it.
 *
 * To upgrade to an ML/LLM engine later, implement PredictiveEngine and change
 * this single `useClass` binding.
 */
@Global()
@Module({
  providers: [{ provide: PREDICTIVE_ENGINE, useClass: RuleBasedPredictiveEngine }],
  exports: [PREDICTIVE_ENGINE],
})
export class AiModule {}
