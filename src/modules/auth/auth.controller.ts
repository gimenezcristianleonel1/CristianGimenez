import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrarse con email y contraseña (gratis, sin proveedor externo)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('google')
  @ApiOperation({
    summary: 'Iniciar sesión con Google (intercambia el ID token por un JWT propio)',
  })
  loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado y su establecimiento' })
  me(@CurrentUser('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Patch('establishment')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar los datos del establecimiento propio' })
  updateEstablishment(
    @CurrentUser('establishmentId') establishmentId: string,
    @Body() dto: UpdateEstablishmentDto,
  ) {
    return this.authService.updateEstablishment(establishmentId, dto);
  }
}
