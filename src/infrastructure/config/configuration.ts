/**
 * Typed configuration factory consumed by `@nestjs/config`.
 * Centralises access to environment variables behind a strongly-typed object.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  database: {
    url: string;
  };
  swagger: {
    enabled: boolean;
    path: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  database: {
    url: process.env.DATABASE_URL as string,
  },
  swagger: {
    enabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
    path: process.env.SWAGGER_PATH ?? 'docs',
  },
});
