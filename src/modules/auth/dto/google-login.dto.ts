import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'ID token (JWT) devuelto por Google Identity Services en el cliente.',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
