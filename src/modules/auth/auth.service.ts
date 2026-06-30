import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Establishment, Prisma, User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';
import { JwtPayload } from './auth.types';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
  establishment: Establishment;
  isNewUser: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;
  private readonly googleClientId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.googleClientId = config.get<string>('auth.googleClientId', '');
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  /**
   * Verifies a Google ID token, provisions the user + their establishment on
   * first login (or recovers them on subsequent logins), and issues our own JWT.
   */
  async loginWithGoogle(idToken: string): Promise<AuthResult> {
    if (!this.googleClientId) {
      throw new ServiceUnavailableException(
        'La autenticación con Google no está configurada (falta GOOGLE_CLIENT_ID)',
      );
    }

    const profile = await this.verifyGoogleToken(idToken);

    const { user, establishment, isNewUser } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { googleId: profile.sub } });

      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { email: profile.email, name: profile.name, picture: profile.picture },
          })
        : await tx.user.create({
            data: {
              googleId: profile.sub,
              email: profile.email,
              name: profile.name,
              picture: profile.picture,
            },
          });

      // Recover the user's establishment, or create the first one on sign-up.
      let establishment = await tx.establishment.findFirst({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      const isNewUser = !establishment;
      if (!establishment) {
        establishment = await tx.establishment.create({
          data: {
            name: `Establecimiento de ${profile.name ?? profile.email}`,
            ownerId: user.id,
          },
        });
      }
      return { user, establishment, isNewUser };
    });

    if (isNewUser) {
      this.logger.log(`New user provisioned: ${user.email} (${user.id})`);
    }

    return {
      accessToken: await this.signToken(user, establishment.id),
      user: this.toPublicUser(user),
      establishment,
      isNewUser,
    };
  }

  /** Returns the authenticated user's profile and their establishment. */
  async getProfile(userId: string): Promise<{ user: PublicUser; establishment: Establishment }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const establishment = await this.prisma.establishment.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!establishment) {
      throw new NotFoundException('El usuario no tiene un establecimiento asociado');
    }
    return { user: this.toPublicUser(user), establishment };
  }

  async updateEstablishment(
    establishmentId: string,
    dto: UpdateEstablishmentDto,
  ): Promise<Establishment> {
    const current = await this.prisma.establishment.findUnique({ where: { id: establishmentId } });
    if (!current) {
      throw new NotFoundException('Establecimiento no encontrado');
    }
    const data: Prisma.EstablishmentUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
      ...(dto.metadata !== undefined
        ? {
            metadata: {
              ...(current.metadata as Record<string, unknown>),
              ...dto.metadata,
            } as Prisma.InputJsonValue,
          }
        : {}),
    };
    return this.prisma.establishment.update({ where: { id: establishmentId }, data });
  }

  private async verifyGoogleToken(idToken: string): Promise<{
    sub: string;
    email: string;
    name: string | null;
    picture: string | null;
  }> {
    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      // Covers invalid/expired tokens and connectivity failures to Google.
      this.logger.warn(`Google token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('No se pudo verificar el token de Google');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('El perfil de Google es incompleto');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }

  private signToken(user: User, establishmentId: string): Promise<string> {
    const payload: JwtPayload = { sub: user.id, establishmentId, email: user.email };
    return this.jwt.signAsync(payload);
  }

  private toPublicUser(user: User): PublicUser {
    return { id: user.id, email: user.email, name: user.name, picture: user.picture };
  }
}
