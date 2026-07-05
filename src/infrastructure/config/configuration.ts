/**
 * Typed configuration factory consumed by `@nestjs/config`.
 * Centralises access to environment variables behind a strongly-typed object.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  database: {
    url: string;
  };
  swagger: {
    enabled: boolean;
    path: string;
  };
  auth: {
    googleClientId: string;
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  whatsapp: {
    verifyToken: string;
    token: string;
    phoneNumberId: string;
    establishmentId: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  push: {
    vapidPublicKey: string;
    vapidPrivateKey: string;
    vapidSubject: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  database: {
    url: process.env.DATABASE_URL as string,
  },
  swagger: {
    enabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
    path: process.env.SWAGGER_PATH ?? 'docs',
  },
  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  },
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    token: process.env.WHATSAPP_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    establishmentId: process.env.WHATSAPP_ESTABLISHMENT_ID ?? '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  },
  push: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:soporte@ganaderia.app',
  },
});
