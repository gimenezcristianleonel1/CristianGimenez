import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Public } from '@modules/auth/decorators/public.decorator';
import { PushService } from './push.service';
import { NotificationsRepository } from './notifications.repository';
import { SubscribeDto } from './dto/subscribe.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly push: PushService,
    private readonly repo: NotificationsRepository,
  ) {}

  @Public()
  @Get('vapid-key')
  @ApiOperation({ summary: 'Clave pública VAPID para suscribirse a Web Push' })
  vapidKey(): { publicKey: string; enabled: boolean } {
    return { publicKey: this.push.publicKey, enabled: this.push.enabled };
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar una suscripción Web Push del establecimiento' })
  async subscribe(
    @CurrentUser('establishmentId') establishmentId: string,
    @Body() dto: SubscribeDto,
  ): Promise<{ ok: true }> {
    await this.repo.upsertSubscription({
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      establishmentId,
    });
    return { ok: true };
  }

  @Post('unsubscribe')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Eliminar una suscripción Web Push por endpoint' })
  async unsubscribe(@Body() body: { endpoint?: string }): Promise<{ ok: true }> {
    if (body?.endpoint) await this.repo.deleteByEndpoint(body.endpoint);
    return { ok: true };
  }
}
