import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Envoltura de `web-push`. Si faltan las claves VAPID, queda inactivo y todo
 * el sistema de avisos degrada sin romper (el server arranca igual).
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('push.vapidPublicKey');
    const privateKey = this.config.get<string>('push.vapidPrivateKey');
    const subject =
      this.config.get<string>('push.vapidSubject') || 'mailto:soporte@ganaderia.app';
    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.ready = true;
        this.logger.log('Web Push habilitado (VAPID configurado).');
      } catch (err) {
        this.logger.warn(`No se pudo configurar VAPID: ${(err as Error).message}`);
      }
    } else {
      this.logger.log('Web Push inactivo (faltan claves VAPID).');
    }
  }

  get enabled(): boolean {
    return this.ready;
  }

  get publicKey(): string {
    return this.config.get<string>('push.vapidPublicKey') ?? '';
  }

  /**
   * Envía un aviso. Devuelve 'gone' cuando el navegador dio de baja la
   * suscripción (404/410) para que el llamador la borre.
   */
  async send(target: PushTarget, payload: PushPayload): Promise<'ok' | 'gone' | 'error'> {
    if (!this.ready) return 'error';
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
      );
      return 'ok';
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      this.logger.warn(`Push falló (${status ?? '?'}): ${(err as Error).message}`);
      return 'error';
    }
  }
}
