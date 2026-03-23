// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// Role hierarchy — index 0 = highest authority
// Used to enforce "you can only create roles below yours"
const ROLE_HIERARCHY: string[] = [
  'SUPER_ADMIN',  // index 0 — can create everyone
  'ADMIN',        // index 1 — can create MANAGER and USER
  'MANAGER',      // index 2 — can create USER only (max 2)
  'USER',         // index 3 — cannot create anyone
];

// ── DTOs ────────────────────────────────────────────────
// Define the shape of data expected from request body

export class LoginDto {
  email: string;
  password: string;
}

export class RegisterDto {
  name: string;
  email: string;
  password: string;
  role: string;
}

// ────────────────────────────────────────────────────────
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // LOGIN
  // Route:  POST /api/auth/login
  // Access: Public — no guard needed
  // ═══════════════════════════════════════════════════════
  async login(dto: LoginDto) {

    // Step 1 — find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Step 2 — vague error so attackers cannot harvest emails
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Step 3 — block disabled accounts even with correct password
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been disabled. Please contact your administrator.',
      );
    }

    // Step 4 — compare entered password with hashed password in DB
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Step 5 — all checks passed → generate JWT token
    const token = this.generateToken(user.id, user.email, user.role);

    // Step 6 — return token + safe user info (never return password)
    return {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  // ═══════════════════════════════════════════════════════
  // REGISTER — Create a new user below the caller
  // Route:  POST /api/auth/register
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  // ═══════════════════════════════════════════════════════
  async register(
    dto: RegisterDto,
    requestingUser: { id: number; role: string },
  ) {

    // Rule 1 — you can only create roles BELOW your own
    // Example: ADMIN(1) creating MANAGER(2) → 2 > 1 → allowed ✅
    //          ADMIN(1) creating ADMIN(1)   → 1 = 1 → blocked ❌
    const myRankIndex = ROLE_HIERARCHY.indexOf(requestingUser.role);
    const targetRankIndex = ROLE_HIERARCHY.indexOf(dto.role);

    if (targetRankIndex <= myRankIndex) {
      throw new ForbiddenException(
        `You cannot create a ${dto.role}. ` +
        `As a ${requestingUser.role} you can only create roles below yours.`,
      );
    }

    // Rule 2 — Manager can only have max 2 users
    if (requestingUser.role === 'MANAGER') {
      const existingCount = await this.prisma.user.count({
        where: { createdBy: requestingUser.id },
      });
      if (existingCount >= 2) {
        throw new ForbiddenException(
          'You have reached the maximum limit. A Manager can only manage 2 users.',
        );
      }
    }

    // Rule 3 — email must be unique across entire system
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException(
        'This email address is already registered in the system.',
      );
    }

    // Hash password before saving — never store plain text
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user — stamp createdBy to track hierarchy tree
    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role as any,
        createdBy: requestingUser.id,
      },
      // Never return password in response
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        createdBy: true,
      },
    });

    return {
      message: `${dto.role} created successfully`,
      user: newUser,
    };
  }

  // ═══════════════════════════════════════════════════════
  // DISABLE USER — soft disable (isActive = false)
  // Route:  PATCH /api/auth/users/:id/disable
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  // Rules:
  //   SUPER_ADMIN → can disable anyone
  //   ADMIN       → can disable users in their branch tree
  //   MANAGER     → can disable only their own 2 users
  // ═══════════════════════════════════════════════════════
  async disableUser(
    targetId: number,
    requestingUser: { id: number; role: string },
  ) {

    // Find target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with id ${targetId} not found`);
    }

    // Cannot disable yourself
    if (targetId === requestingUser.id) {
      throw new ForbiddenException('You cannot disable your own account.');
    }

    // Super Admin can disable anyone — skip ownership check
    if (requestingUser.role !== 'SUPER_ADMIN') {

      // Check if target belongs to requester's branch tree
      const isInBranch = await this.isUserInBranch(targetId, requestingUser.id);

      if (!isInBranch) {
        throw new ForbiddenException(
          'You can only disable users that belong to your branch.',
        );
      }
    }

    // Soft disable — isActive = false (data is never deleted)
    await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: false },
    });

    // Cascade disable — disable all users below this user too
    // Manager disabled → their 2 users also disabled
    // Admin disabled → all their Managers + those Managers' users disabled
    await this.cascadeDisable(targetId);

    return {
      message: `User "${targetUser.name}" has been disabled successfully.`,
    };
  }

  // ── PRIVATE: Cascade disable ───────────────────────────
  // Recursively disables all users in the subtree below parentId
  private async cascadeDisable(parentId: number): Promise<void> {
    const children = await this.prisma.user.findMany({
      where: { createdBy: parentId },
    });

    for (const child of children) {
      await this.prisma.user.update({
        where: { id: child.id },
        data: { isActive: false },
      });
      // Recursively go deeper
      await this.cascadeDisable(child.id);
    }
  }

  // ═══════════════════════════════════════════════════════
  // ENABLE USER — re-activate a disabled account
  // Route:  PATCH /api/auth/users/:id/enable
  // Access: SUPER_ADMIN, ADMIN only
  // Rules:
  //   SUPER_ADMIN → can enable anyone in the system
  //   ADMIN       → can enable anyone in their branch tree
  //                 (directly created OR created by their managers)
  //   MANAGER     → BLOCKED (needs higher authority approval)
  // ═══════════════════════════════════════════════════════
  async enableUser(
    targetId: number,
    requestingUser: { id: number; role: string },
  ) {

    // Find target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with id ${targetId} not found`);
    }

    // Only SUPER_ADMIN and ADMIN can re-enable accounts
    if (
      requestingUser.role !== 'SUPER_ADMIN' &&
      requestingUser.role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Only Super Admin or Admin can re-enable user accounts.',
      );
    }

    // Super Admin can enable anyone — no ownership check needed
    if (requestingUser.role === 'SUPER_ADMIN') {
      await this.prisma.user.update({
        where: { id: targetId },
        data: { isActive: true },
      });
      return {
        message: `User "${targetUser.name}" has been re-enabled successfully.`,
      };
    }

    // Admin branch check — Admin can enable anyone in their branch tree
    // This includes:
    //   ✅ Users Admin directly created (createdBy = adminId)
    //   ✅ Users created by Admin's Managers (createdBy = managerId, managerId.createdBy = adminId)
    //   ❌ Users in other Admin's branches
    const isInBranch = await this.isUserInBranch(targetId, requestingUser.id);

    if (!isInBranch) {
      throw new ForbiddenException(
        'You can only re-enable users that belong to your branch.',
      );
    }

    // Re-activate the user
    await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: true },
    });

    return {
      message: `User "${targetUser.name}" has been re-enabled successfully.`,
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET PROFILE — fetch logged-in user's own profile
  // Route:  GET /api/auth/profile
  // Access: Any logged-in user
  // ═══════════════════════════════════════════════════════
  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        // Load permission overrides
        // React frontend uses this to show/hide menu items
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    return user;
  }

  // ── PRIVATE: Check if user belongs to admin's branch ───
  // Walks UP the hierarchy tree checking if adminId
  // is an ancestor of targetUserId
  //
  // Example:
  //   Staff 1 (id:4) → createdBy Manager 1 (id:3)
  //   Manager 1 (id:3) → createdBy Admin 1 (id:2)
  //   Admin 1 (id:2) → match found ✅
  private async isUserInBranch(
    targetUserId: number,
    adminId: number,
  ): Promise<boolean> {

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    // Reached top of tree — admin not found in ancestry
    if (!targetUser || targetUser.createdBy === null) return false;

    // Direct match — admin directly created this user
    if (targetUser.createdBy === adminId) return true;

    // Walk one level up — check the parent's parent
    return this.isUserInBranch(targetUser.createdBy, adminId);
  }

  // ── PRIVATE: Generate JWT token ─────────────────────────
  // Creates a signed token containing user id, email, role
  // Token is stateless — not stored in DB
  private generateToken(id: number, email: string, role: string): string {
    return this.jwtService.sign({
      sub: id,    // sub = subject = user id (standard JWT claim)
      email,
      role,
    });
  }
}