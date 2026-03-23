// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Fields we always select for user responses
// Password is deliberately excluded — never return it
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // GET ALL USERS — filtered by role
  // Route:  GET /api/users
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  //
  // SUPER_ADMIN → sees every user in the system
  // ADMIN       → sees only users in their branch tree
  // MANAGER     → sees only their own 2 users
  // ═══════════════════════════════════════════════════════
  async findAll(requestingUser: { id: number; role: string }) {

    // Super Admin — return ALL users in the system
    if (requestingUser.role === 'SUPER_ADMIN') {
      return this.prisma.user.findMany({
        select: USER_SELECT,
        orderBy: { createdAt: 'asc' },
      });
    }

    // Admin — return only users in their branch tree
    // Collect all user IDs that belong to this Admin's tree
    if (requestingUser.role === 'ADMIN') {
      const branchUserIds = await this.getBranchUserIds(requestingUser.id);
      return this.prisma.user.findMany({
        where: {
          id: { in: branchUserIds },
        },
        select: USER_SELECT,
        orderBy: { createdAt: 'asc' },
      });
    }

    // Manager — return only their own 2 users (directly created)
    if (requestingUser.role === 'MANAGER') {
      return this.prisma.user.findMany({
        where: {
          createdBy: requestingUser.id,
        },
        select: USER_SELECT,
        orderBy: { createdAt: 'asc' },
      });
    }

    // USER role — cannot list users
    throw new ForbiddenException('You do not have permission to list users.');
  }

  // ═══════════════════════════════════════════════════════
  // GET SINGLE USER by ID
  // Route:  GET /api/users/:id
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  //
  // Each role can only view users within their authority
  // ═══════════════════════════════════════════════════════
  async findOne(
    targetId: number,
    requestingUser: { id: number; role: string },
  ) {

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        ...USER_SELECT,
        // Also load their permission overrides
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${targetId} not found`);
    }

    // Super Admin can view anyone
    if (requestingUser.role === 'SUPER_ADMIN') return user;

    // Admin can view users in their branch tree
    if (requestingUser.role === 'ADMIN') {
      const branchUserIds = await this.getBranchUserIds(requestingUser.id);
      if (!branchUserIds.includes(targetId)) {
        throw new ForbiddenException(
          'You can only view users that belong to your branch.',
        );
      }
      return user;
    }

    // Manager can only view their own 2 users
    if (requestingUser.role === 'MANAGER') {
      if (user.createdBy !== requestingUser.id) {
        throw new ForbiddenException(
          'You can only view users that you have created.',
        );
      }
      return user;
    }

    throw new ForbiddenException('You do not have permission to view this user.');
  }

  // ═══════════════════════════════════════════════════════
  // GET MY PROFILE — logged-in user's own profile
  // Route:  GET /api/users/me
  // Access: Any logged-in user
  // ═══════════════════════════════════════════════════════
  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SELECT,
        // Load permissions — frontend uses this to show/hide pages
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE USER — update name or email
  // Route:  PATCH /api/users/:id
  // Access: SUPER_ADMIN, ADMIN, MANAGER (own users only)
  // ═══════════════════════════════════════════════════════
  async updateUser(
    targetId: number,
    dto: { name?: string; email?: string },
    requestingUser: { id: number; role: string },
  ) {

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with id ${targetId} not found`);
    }

    // Super Admin can update anyone
    if (requestingUser.role !== 'SUPER_ADMIN') {

      // Admin — check branch ownership
      if (requestingUser.role === 'ADMIN') {
        const branchUserIds = await this.getBranchUserIds(requestingUser.id);
        if (!branchUserIds.includes(targetId)) {
          throw new ForbiddenException(
            'You can only update users in your branch.',
          );
        }
      }

      // Manager — only their direct users
      if (requestingUser.role === 'MANAGER') {
        if (targetUser.createdBy !== requestingUser.id) {
          throw new ForbiddenException(
            'You can only update users that you have created.',
          );
        }
      }

      // User — can only update themselves
      if (requestingUser.role === 'USER') {
        if (targetId !== requestingUser.id) {
          throw new ForbiddenException(
            'You can only update your own profile.',
          );
        }
      }
    }

    // Perform the update
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        // Only update fields that were provided
        ...(dto.name  && { name: dto.name }),
        ...(dto.email && { email: dto.email }),
      },
      select: USER_SELECT,
    });

    return {
      message: 'User updated successfully',
      user: updated,
    };
  }

  // ── PRIVATE: Get all user IDs in Admin's branch tree ───
  // Collects IDs of ALL users below a given parentId
  // Used by Admin to filter their visible users
  //
  // Example for Admin (id:2):
  //   Manager 1 (createdBy:2) → id:3
  //   Staff 1 (createdBy:3)   → id:4
  //   Staff 2 (createdBy:3)   → id:5
  //   Result: [3, 4, 5]
  private async getBranchUserIds(parentId: number): Promise<number[]> {
    const ids: number[] = [];

    const children = await this.prisma.user.findMany({
      where: { createdBy: parentId },
      select: { id: true },
    });

    for (const child of children) {
      ids.push(child.id);
      // Recursively collect children's children
      const grandChildren = await this.getBranchUserIds(child.id);
      ids.push(...grandChildren);
    }

    return ids;
  }
}