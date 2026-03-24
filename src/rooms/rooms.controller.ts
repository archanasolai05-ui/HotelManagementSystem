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
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // ── POST /api/rooms ─────────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('rooms', 'create')
  @Post()
  create(@Body() body: CreateRoomDto) {
    return this.roomsService.create(body);
  }

  // ── GET /api/rooms ──────────────────────────────────────
  // ?status=AVAILABLE&type=Suite&floor=2&isActive=true
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('rooms', 'read')
  @Get()
  findAll(
    @Query('status')   status?:   string,
    @Query('type')     type?:     string,
    @Query('floor')    floor?:    number,
    @Query('isActive') isActive?: string,
  ) {
    return this.roomsService.findAll({
      status,
      type,
      floor,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // ── GET /api/rooms/:id ──────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('rooms', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findOne(id);
  }

  // ── PATCH /api/rooms/:id ────────────────────────────────
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
  // Manual status override — only AVAILABLE and MAINTENANCE allowed.
  // OCCUPIED is set automatically by check-in/check-out.
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
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('rooms', 'delete')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.remove(id);
  }
}