import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'productor@campo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'unaClaveSegura' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
