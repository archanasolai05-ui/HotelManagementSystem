// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
    // NOTE: config is NOT private here — we only use it in super()
    // NestJS requires constructor params used in super() to not be private
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // FIX — read JWT_SECRET directly from process.env
      // This guarantees a string — no undefined issue
      // process.env is always available after ConfigModule loads
      secretOrKey: process.env.JWT_SECRET ?? 'fallback_secret',

      ignoreExpiration: false,
    });

    // Store prisma for use in validate()
    this.prisma = prisma;
  }

  // Runs on every protected request after token is verified
  async validate(payload: JwtPayload) {

    // Find user in DB using id stored inside the token
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // User deleted from DB — reject token
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // User disabled — block even a valid token
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been disabled. Contact your administrator.',
      );
    }

    // Returned value is attached to request.user in every controller
    return user;
  }
}