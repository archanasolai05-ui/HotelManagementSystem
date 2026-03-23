// src/permissions/permissions.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Role hierarchy — used to prevent toggling permissions
// for roles equal to or above your own
const ROLE_HIERARCHY: string[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'USER',
];

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // GET ALL PERMISSIONS — list every permission in system
  // Route:  GET /api/permissions
  // Access: SUPER_ADMIN, ADMIN
  // ═══════════════════════════════════════════════════════
  async findAll() {
    return this.prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { action: 'asc' },
      ],
    });
  }

  // ═══════════════════════════════════════════════════════
  // GET PERMISSIONS FOR A ROLE
  // Route:  GET /api/permissions/role/:role
  // Access: SUPER_ADMIN, ADMIN
  // Returns all permissions with isEnabled status for that role
  // Frontend uses this to build the permissions toggle dashboard
  // ═══════════════════════════════════════════════════════
  async getRolePermissions(role: string) {

    // Get all permissions with their enabled status for this role
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { role: role as any },
      include: {
        permission: true, // load module + action details
      },
      orderBy: [
        { permission: { module: 'asc' } },
        { permission: { action: 'asc' } },
      ],
    });

    // Format response — group by module for easy frontend rendering
    const grouped: Record<string, any[]> = {};

    for (const rp of rolePerms) {
      const mod = rp.permission.module;
      if (!grouped[mod]) grouped[mod] = [];
      grouped[mod].push({
        permissionId: rp.permissionId,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description,
        isEnabled: rp.isEnabled,
      });
    }

    return {
      role,
      permissions: grouped,
    };
  }

  // ═══════════════════════════════════════════════════════
  // TOGGLE ROLE PERMISSION — enable or disable for a role
  // Route:  PATCH /api/permissions/role/:role/toggle
  // Access: SUPER_ADMIN, ADMIN
  // Body:   { permissionId: number, isEnabled: boolean }
  //
  // When isEnabled = false → PermissionsGuard blocks that
  // feature for ALL users with that role immediately
  // ═══════════════════════════════════════════════════════
  async toggleRolePermission(
    role: string,
    dto: { permissionId: number; isEnabled: boolean },
    requestingUser: { id: number; role: string },
  ) {

    // Rule — you cannot toggle permissions for roles
    // equal to or above your own
    const myRankIndex = ROLE_HIERARCHY.indexOf(requestingUser.role);
    const targetRankIndex = ROLE_HIERARCHY.indexOf(role);

    if (targetRankIndex <= myRankIndex) {
      throw new ForbiddenException(
        `You cannot modify permissions for ${role}. ` +
        `You can only modify roles below yours.`,
      );
    }

    // Check permission exists
    const permission = await this.prisma.permission.findUnique({
      where: { id: dto.permissionId },
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission with id ${dto.permissionId} not found`,
      );
    }

    // Update the role permission — create if not exists
    const updated = await this.prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: role as any,
          permissionId: dto.permissionId,
        },
      },
      update: {
        isEnabled: dto.isEnabled,
        grantedBy: requestingUser.id,
      },
      create: {
        role: role as any,
        permissionId: dto.permissionId,
        isEnabled: dto.isEnabled,
        grantedBy: requestingUser.id,
      },
      include: { permission: true },
    });

    return {
      message: `Permission "${permission.module} → ${permission.action}" ` +
               `has been ${dto.isEnabled ? 'enabled' : 'disabled'} ` +
               `for role ${role}`,
      permission: updated,
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET USER PERMISSION OVERRIDES
  // Route:  GET /api/permissions/user/:userId
  // Access: SUPER_ADMIN, ADMIN, MANAGER (own users only)
  // Returns all permission overrides set for this specific user
  // ═══════════════════════════════════════════════════════
  async getUserPermissions(
    targetUserId: number,
    requestingUser: { id: number; role: string },
  ) {

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with id ${targetUserId} not found`);
    }

    // Manager can only view permissions for their own users
    if (requestingUser.role === 'MANAGER') {
      if (targetUser.createdBy !== requestingUser.id) {
        throw new ForbiddenException(
          'You can only view permissions for users you manage.',
        );
      }
    }

    const userPerms = await this.prisma.userPermission.findMany({
      where: { userId: targetUserId },
      include: { permission: true },
      orderBy: [
        { permission: { module: 'asc' } },
        { permission: { action: 'asc' } },
      ],
    });

    return {
      userId: targetUserId,
      userName: targetUser.name,
      userRole: targetUser.role,
      permissions: userPerms.map(up => ({
        permissionId: up.permissionId,
        module: up.permission.module,
        action: up.permission.action,
        description: up.permission.description,
        isEnabled: up.isEnabled,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════
  // TOGGLE USER PERMISSION OVERRIDE
  // Route:  PATCH /api/permissions/user/:userId/toggle
  // Access: SUPER_ADMIN, ADMIN, MANAGER (own users only)
  // Body:   { permissionId: number, isEnabled: boolean }
  //
  // This creates a user-level OVERRIDE on top of role permission
  // Example: All MANAGERs cannot access billing (role level OFF)
  //          But Admin gives User 7 special billing access (user override ON)
  //          Result: Only User 7 can access billing
  //
  // IMPORTANT RULE: You cannot give a permission you don't have yourself
  // ═══════════════════════════════════════════════════════
  async toggleUserPermission(
    targetUserId: number,
    dto: { permissionId: number; isEnabled: boolean },
    requestingUser: { id: number; role: string },
  ) {

    // Find target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with id ${targetUserId} not found`);
    }

    // Rule 1 — can only set permissions for users below your rank
    const myRankIndex = ROLE_HIERARCHY.indexOf(requestingUser.role);
    const targetRankIndex = ROLE_HIERARCHY.indexOf(targetUser.role);

    if (targetRankIndex <= myRankIndex) {
      throw new ForbiddenException(
        'You can only set permissions for users with a role below yours.',
      );
    }

    // Rule 2 — Manager can only set for their own users
    if (requestingUser.role === 'MANAGER') {
      if (targetUser.createdBy !== requestingUser.id) {
        throw new ForbiddenException(
          'You can only set permissions for users you manage.',
        );
      }
    }

    // Rule 3 — Cannot give a permission you don't have yourself
    // Check if requestingUser has this permission via role or override
    if (dto.isEnabled) {
      const hasPerm = await this.checkUserHasPermission(
        requestingUser.id,
        requestingUser.role,
        dto.permissionId,
      );
      if (!hasPerm && requestingUser.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'You cannot grant a permission that you do not have yourself.',
        );
      }
    }

    // Check permission exists
    const permission = await this.prisma.permission.findUnique({
      where: { id: dto.permissionId },
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission with id ${dto.permissionId} not found`,
      );
    }

    // Create or update the user-level permission override
    const updated = await this.prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId: targetUserId,
          permissionId: dto.permissionId,
        },
      },
      update: {
        isEnabled: dto.isEnabled,
        grantedBy: requestingUser.id,
      },
      create: {
        userId: targetUserId,
        permissionId: dto.permissionId,
        isEnabled: dto.isEnabled,
        grantedBy: requestingUser.id,
      },
      include: { permission: true },
    });

    return {
      message: `Permission "${permission.module} → ${permission.action}" ` +
               `has been ${dto.isEnabled ? 'enabled' : 'disabled'} ` +
               `for user "${targetUser.name}"`,
      permission: updated,
    };
  }

  // ── PRIVATE: Check if a user has a specific permission ─
  // Checks user-level override first, then role-level
  private async checkUserHasPermission(
    userId: number,
    role: string,
    permissionId: number,
  ): Promise<boolean> {

    // Check user-level override first
    const userPerm = await this.prisma.userPermission.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });

    if (userPerm) return userPerm.isEnabled;

    // Fall back to role-level permission
    const rolePerm = await this.prisma.rolePermission.findUnique({
      where: {
        role_permissionId: {
          role: role as any,
          permissionId,
        },
      },
    });

    return rolePerm?.isEnabled ?? false;
  }
}