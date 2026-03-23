// src/users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
// ↑ All routes in this controller require a valid JWT token
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── GET /api/users ─────────────────────────────────────
  // List users — each role sees different filtered results
  // Super Admin → all users
  // Admin       → their branch only
  // Manager     → their 2 users only
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @Get()
  findAll(@CurrentUser() currentUser: any) {
    return this.usersService.findAll(currentUser);
  }

  // ── GET /api/users/me ───────────────────────────────────
  // Get own profile — available to ALL logged-in users
  // Must be defined BEFORE /:id to avoid conflict
  @Get('me')
  getMe(@CurrentUser() currentUser: any) {
    return this.usersService.getMe(currentUser.id);
  }

  // ── GET /api/users/:id ──────────────────────────────────
  // Get specific user — filtered by role authority
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.findOne(id, currentUser);
  }

  // ── PATCH /api/users/:id ────────────────────────────────
  // Update user name or email
  @Patch(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; email?: string },
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.updateUser(id, body, currentUser);
  }
}