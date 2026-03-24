// src/bookings/bookings.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ── Create booking ─────────────────────────────────────────────────
  // FIX: Added USER so staff with 'bookings create' permission can create
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')   // ← added USER
  @RequirePermission('bookings', 'create')
  @Post()
  create(@Body() body: any, @CurrentUser() currentUser: any) {
    return this.bookingsService.create(body, currentUser);
  }

  // ── List all bookings ──────────────────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('bookings', 'read')
  @Get()
  findAll(
    @CurrentUser() currentUser: any,
    @Query('status') status?: string,
    @Query('roomId') roomId?: number,
  ) {
    return this.bookingsService.findAll(currentUser, { status, roomId });
  }

  // ── Check availability ─────────────────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('bookings', 'read')
  @Get('availability')
  checkAvailability(
    @Query('roomId')   roomId:   string,
    @Query('checkIn')  checkIn:  string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.bookingsService.checkRoomAvailability(
      Number(roomId), checkIn, checkOut,
    );
  }

  // ── Booked dates for room ──────────────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('bookings', 'read')
  @Get('room/:roomId/booked-dates')
  getBookedDates(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.bookingsService.getBookedDatesForRoom(roomId);
  }

  // ── Get single booking ─────────────────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('bookings', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.findOne(id);
  }

  // ── Check in ───────────────────────────────────────────────────────
  // FIX: Added USER so staff with 'bookings update' permission can check in
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')   // ← added USER
  @RequirePermission('bookings', 'update')
  @Patch(':id/checkin')
  checkIn(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.checkIn(id);
  }

  // ── Check out ──────────────────────────────────────────────────────
  // FIX: Added USER so staff with 'bookings update' permission can check out
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')   // ← added USER
  @RequirePermission('bookings', 'update')
  @Patch(':id/checkout')
  checkOut(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.checkOut(id);
  }

  // ── Cancel booking ─────────────────────────────────────────────────
  // FIX: Added USER so staff with 'bookings update' permission can cancel
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')   // ← added USER
  @RequirePermission('bookings', 'update')
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.cancel(id);
  }
}