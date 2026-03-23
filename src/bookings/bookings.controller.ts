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

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('bookings', 'create')
  @Post()
  create(@Body() body: any, @CurrentUser() currentUser: any) {
    return this.bookingsService.create(body, currentUser);
  }

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

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER')
  @RequirePermission('bookings', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.findOne(id);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('bookings', 'update')
  @Patch(':id/checkin')
  checkIn(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.checkIn(id);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('bookings', 'update')
  @Patch(':id/checkout')
  checkOut(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.checkOut(id);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('bookings', 'update')
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.cancel(id);
  }
}