import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { GeminiService } from './gemini.service';
import { EventProcessorService } from './event-processor.service';

/**
 * Orquesta el flujo de WhatsApp Cloud API:
 *   verificación del webhook · parseo del payload de Meta · resolución del
 *   establecimiento por teléfono · IA (Gemini) · motor de eventos · respuesta.
 *
 * Todo con try/catch: un fallo nunca tumba el server y Meta siempre recibe 200.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  /** Dedupe de reintentos de Meta (in-memory; suficiente para 1 instancia). */
  private readonly seen = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly processor: EventProcessorService,
  ) {}

  /** GET /webhook: verificación inicial de Meta. */
  verifyWebhook(mode: string, token: string, challenge: string): string {
    const expected = this.config.get<string>('whatsapp.verifyToken');
    if (mode === 'subscribe' && expected && token === expected) return challenge;
    throw new ForbiddenException('Verificación de webhook inválida');
  }

  /** POST /webhook: procesa un mensaje entrante (jamás lanza al caller). */
  async handleIncoming(body: unknown): Promise<void> {
    try {
      const value = (body as any)?.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];
      if (!msg || msg.type !== 'text') return; // ignoramos estados / no-texto
      if (this.seen.has(msg.id)) return; // reintento de Meta
      this.seen.add(msg.id);
      if (this.seen.size > 500) this.seen.clear();

      const from: string = msg.from;
      const text: string = msg.text?.body ?? '';
      if (!text.trim()) return;

      const establishmentId = await this.resolveEstablishment(from);
      if (!establishmentId) {
        this.logger.warn(`Número no autorizado: ${from}`);
        return; // no respondemos a desconocidos (seguridad)
      }

      if (!this.gemini.enabled) {
        await this.reply(from, 'El asistente todavía no está configurado.');
        return;
      }

      const parsed = await this.gemini.parse(text);
      if (!parsed) {
        await this.reply(from, 'No pude procesar el mensaje. Probá de nuevo, más simple.');
        return;
      }

      const answer = await this.processor.process(establishmentId, parsed);
      await this.reply(from, answer);
    } catch (err) {
      this.logger.error(`handleIncoming: ${(err as Error).message}`);
    }
  }

  /** Teléfono → establecimiento (metadata.whatsapp.operators o env fallback). */
  private async resolveEstablishment(phone: string): Promise<string | null> {
    try {
      const est = await this.prisma.establishment.findFirst({
        where: { metadata: { path: ['whatsapp', 'operators'], array_contains: phone } },
        select: { id: true },
      });
      if (est) return est.id;
    } catch {
      /* filtro JSON no disponible: caemos al env */
    }
    return this.config.get<string>('whatsapp.establishmentId') || null;
  }

  /** Respuesta de texto libre (gratis dentro de la ventana de 24 h). */
  private async reply(to: string, message: string): Promise<void> {
    const token = this.config.get<string>('whatsapp.token');
    const phoneId = this.config.get<string>('whatsapp.phoneNumberId');
    if (!token || !phoneId) return;
    try {
      await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      });
    } catch (err) {
      this.logger.warn(`No se pudo responder a ${to}: ${(err as Error).message}`);
    }
  }
}
