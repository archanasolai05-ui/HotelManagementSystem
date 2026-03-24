// src/permissions/permissions.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ── GET /api/permissions ────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  // ── GET /api/permissions/role/:role ─────────────────────
  // FIX: Added MANAGER so they can load USER role permissions
  // when opening the permissions panel for their staff
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')   // ← added MANAGER
  @Get('role/:role')
  getRolePermissions(@Param('role') role: string) {
    return this.permissionsService.getRolePermissions(role);
  }

  // ── PATCH /api/permissions/role/:role/toggle ─────────────
  // Only SUPER_ADMIN and ADMIN can toggle role-level permissions
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('role/:role/toggle')
  toggleRolePermission(
    @Param('role') role: string,
    @Body() body: { permissionId: number; isEnabled: boolean },
    @CurrentUser() currentUser: any,
  ) {
    return this.permissionsService.toggleRolePermission(
      role, body, currentUser,
    );
  }

  // ── GET /api/permissions/user/:userId ───────────────────
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @Get('user/:userId')
  getUserPermissions(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.permissionsService.getUserPermissions(userId, currentUser);
  }

  // ── PATCH /api/permissions/user/:userId/toggle ──────────
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @Patch('user/:userId/toggle')
  toggleUserPermission(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { permissionId: number; isEnabled: boolean },
    @CurrentUser() currentUser: any,
  ) {
    return this.permissionsService.toggleUserPermission(
      userId, body, currentUser,
    );
  }
}