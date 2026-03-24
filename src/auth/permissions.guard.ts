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

    // Layer 1 — role-level permission (check this first)
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

    // If role-level permission is disabled, deny access (no override allowed)
    if (!rolePerm) {
      throw new ForbiddenException(
        `Permission denied. No access to: ${module} → ${action}`,
      );
    }

    // Layer 2 — user-level override (only checked if role allows)
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

    // If user-level override exists, use it
    if (userPerm) {
      if (!userPerm.isEnabled) {
        throw new ForbiddenException(
          `Permission denied. No access to: ${module} → ${action}`,
        );
      }
      return true;
    }

    // No user-level override, but role-level allows, so allow
    return true;
  }
}