import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

class SubscribeKeysDto {
  @ApiProperty({ description: 'Clave pública del cliente (p256dh)' })
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @ApiProperty({ description: 'Secreto de autenticación del cliente' })
  @IsString()
  @IsNotEmpty()
  auth!: string;
}

/** Suscripción tal como la entrega `PushSubscription.toJSON()` del navegador. */
export class SubscribeDto {
  @ApiProperty({ description: 'Endpoint del servicio de push del navegador' })
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @ApiProperty({ type: SubscribeKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SubscribeKeysDto)
  keys!: SubscribeKeysDto;
}
