import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { GeminiService } from './gemini.service';
import { EventProcessorService } from './event-processor.service';

/**
 * Módulo aislado del bot de WhatsApp. No exporta nada ni toca otros módulos;
 * consume PrismaService (global) y ConfigService. Se enchufa con un solo import
 * en AppModule. Si faltan las variables de entorno, el bot queda inerte.
 */
@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, GeminiService, EventProcessorService],
})
export class WhatsappModule {}
