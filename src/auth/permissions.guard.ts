// src/auth/permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<{
      module: string;
      action: string;
    }>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    const { module, action } = required;

    // SUPER_ADMIN bypasses all permission checks
    if (user.role === 'SUPER_ADMIN') return true;

    // Layer 1 — user-level override (Prisma 6 syntax)
    const userPerm = await this.prisma.userPermission.findFirst({
      where: {
        userId: user.id,
        permission: {
          is: {
            module,
            action,
          },
        },
      },
      include: { permission: true },
    });

    if (userPerm) {
      if (!userPerm.isEnabled) {
        throw new ForbiddenException(
          `Permission denied. No access to: ${module} → ${action}`,
        );
      }
      return true;
    }

    // Layer 2 — role-level permission (Prisma 6 syntax)
    const rolePerm = await this.prisma.rolePermission.findFirst({
      where: {
        role: user.role,
        isEnabled: true,
        permission: {
          is: {
            module,
            action,
          },
        },
      },
    });

    if (!rolePerm) {
      throw new ForbiddenException(
        `Permission denied. No access to: ${module} → ${action}`,
      );
    }

    return true;
  }
}