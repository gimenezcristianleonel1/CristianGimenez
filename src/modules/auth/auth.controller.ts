import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
