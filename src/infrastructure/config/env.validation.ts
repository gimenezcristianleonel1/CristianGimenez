import * as Joi from 'joi';

/**
 * Strict validation schema for environment variables.
 * The application will refuse to boot if any required variable is missing
 * or malformed, preventing misconfigured deployments.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGIN: Joi.string().default('*'),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),

  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('docs'),

  // Autenticación
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  JWT_SECRET: Joi.string().min(16).default('dev-insecure-change-me-please-32chars'),
  JWT_EXPIRES_IN: Joi.string().default('30d'),
});
