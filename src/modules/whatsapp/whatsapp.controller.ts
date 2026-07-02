import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@modules/auth/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';

/**
 * Webhook de WhatsApp Cloud API. Rutas PÚBLICAS (las llama Meta, sin JWT) y
 * AISLADAS bajo /whatsapp: no tocan ningún endpoint que use el frontend.
 * Excluido de Swagger.
 *
 * URL a configurar en Meta:  https://<tu-api>/api/v1/whatsapp/webhook
 */
@ApiExcludeController()
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Public()
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.whatsapp.verifyWebhook(mode, token, challenge);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200) // Meta exige un 200 rápido; procesamos en segundo plano.
  receive(@Body() body: unknown): { status: string } {
    void this.whatsapp.handleIncoming(body);
    return { status: 'received' };
  }
}
