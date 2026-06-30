import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'productor@campo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'unaClaveSegura', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(72) // límite de bcrypt
  password!: string;

  @ApiPropertyOptional({ example: 'Juan Productor' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Estancia La Esperanza', description: 'Nombre del establecimiento' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  establishmentName?: string;
}
