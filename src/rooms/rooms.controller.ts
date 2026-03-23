// src/rooms/rooms.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { RoomsService, CreateRoomDto, UpdateRoomDto } from './rooms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
// ↑ All routes require valid JWT token
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // ── POST /api/rooms ─────────────────────────────────────
  // Create a new room
  // Requires role + permission check
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('rooms', 'create')
  @Post()
  create(@Body() body: CreateRoomDto) {
    return this.roomsService.create(body);
  }

  // ── GET /api/rooms ──────────────────────────────────────
  // List all rooms with optional filters
  // ?status=AVAILABLE&type=Suite&floor=2
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('rooms', 'read')
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('floor') floor?: number,
    @Query('isActive') isActive?: string,
  ) {
    return this.roomsService.findAll({
      status,
      type,
      floor,
      // Convert string query param to boolean
      isActive: isActive !== undefined
        ? isActive === 'true'
        : undefined,
    });
  }

  // ── GET /api/rooms/:id ──────────────────────────────────
  // Get single room details
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('rooms', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findOne(id);
  }

  // ── PATCH /api/rooms/:id ────────────────────────────────
  // Update room details
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('rooms', 'update')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRoomDto,
  ) {
    return this.roomsService.update(id, body);
  }

  // ── PATCH /api/rooms/:id/status ─────────────────────────
  // Quick status update — AVAILABLE / OCCUPIED / MAINTENANCE
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('rooms', 'update')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.roomsService.updateStatus(id, body.status);
  }

  // ── DELETE /api/rooms/:id ───────────────────────────────
  // Soft delete — sets isActive = false
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('rooms', 'delete')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.remove(id);
  }
}