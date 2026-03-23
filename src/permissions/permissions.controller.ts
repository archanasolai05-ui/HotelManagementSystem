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
// ↑ All routes require valid JWT token
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ── GET /api/permissions ────────────────────────────────
  // List all permissions in the system
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  // ── GET /api/permissions/role/:role ─────────────────────
  // Get all permissions with enabled status for a role
  // Frontend uses this to build toggle dashboard
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('role/:role')
  getRolePermissions(@Param('role') role: string) {
    return this.permissionsService.getRolePermissions(role);
  }

  // ── PATCH /api/permissions/role/:role/toggle ─────────────
  // Toggle a permission ON or OFF for a role
  // Body: { permissionId: number, isEnabled: boolean }
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
  // Get permission overrides for a specific user
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
  // Toggle a permission override for a specific user
  // Body: { permissionId: number, isEnabled: boolean }
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