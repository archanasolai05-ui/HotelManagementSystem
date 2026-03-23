// src/billing/billing.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── GET /api/billing/summary ────────────────────────────
  // Revenue summary — must be before /:id to avoid conflict
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('billing', 'read')
  @Get('summary')
  getSummary() {
    return this.billingService.getSummary();
  }

  // ── GET /api/billing ────────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('billing', 'read')
  @Get()
  findAll(
    @CurrentUser() currentUser: any,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.billingService.findAll(currentUser, { paymentStatus });
  }

  // ── GET /api/billing/booking/:bookingId ─────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('billing', 'read')
  @Get('booking/:bookingId')
  findByBooking(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.billingService.findByBooking(bookingId);
  }

  // ── GET /api/billing/:id ────────────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('billing', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findOne(id);
  }

  // ── PATCH /api/billing/:id/pay ──────────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @RequirePermission('billing', 'update')
  @Patch(':id/pay')
  processPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentMethod: string },
  ) {
    return this.billingService.processPayment(id, body);
  }

  // ── PATCH /api/billing/:id/discount ─────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('billing', 'update')
  @Patch(':id/discount')
  applyDiscount(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { discount: number },
    @CurrentUser() currentUser: any,
  ) {
    return this.billingService.applyDiscount(id, body, currentUser);
  }

  // ── PATCH /api/billing/:id/refund ───────────────────────
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermission('billing', 'update')
  @Patch(':id/refund')
  refund(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.billingService.refund(id, currentUser);
  }
}