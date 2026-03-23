// src/billing/billing.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateBillingDto {
  discount?: number;
  paymentMethod?: string;  // 'cash', 'card', 'upi'
  paymentStatus?: string;  // 'PAID', 'UNPAID', 'REFUNDED'
}

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // GET ALL BILLING RECORDS — filtered by role
  // Route:  GET /api/billing
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  //         (needs billing→read permission)
  // ═══════════════════════════════════════════════════════
  async findAll(
    requestingUser: { id: number; role: string },
    filters: { paymentStatus?: string },
  ) {

    const where: any = {};

    // Filter by payment status if provided
    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    // MANAGER — only see billing for their bookings
    if (requestingUser.role === 'MANAGER') {
      const myUserIds = await this.prisma.user.findMany({
        where: { createdBy: requestingUser.id },
        select: { id: true },
      });
      const ids = [requestingUser.id, ...myUserIds.map(u => u.id)];
      where.booking = { userId: { in: ids } };
    }

    const billings = await this.prisma.billing.findMany({
      where,
      include: {
        booking: {
          include: {
            guest: true,
            room:  true,
            user: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary stats
    const totalRevenue = billings
      .filter(b => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const unpaidCount = billings.filter(
      b => b.paymentStatus === 'UNPAID',
    ).length;

    return {
      total: billings.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      unpaidCount,
      billings,
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET SINGLE BILLING RECORD
  // Route:  GET /api/billing/:id
  // ═══════════════════════════════════════════════════════
  async findOne(id: number) {
    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            guest: true,
            room:  true,
            user: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });

    if (!billing) {
      throw new NotFoundException(`Billing record with id ${id} not found`);
    }

    return billing;
  }

  // ═══════════════════════════════════════════════════════
  // GET BILLING BY BOOKING ID
  // Route:  GET /api/billing/booking/:bookingId
  // ═══════════════════════════════════════════════════════
  async findByBooking(bookingId: number) {
    const billing = await this.prisma.billing.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            guest: true,
            room:  true,
          },
        },
      },
    });

    if (!billing) {
      throw new NotFoundException(
        `No billing record found for booking ${bookingId}`,
      );
    }

    return billing;
  }

  // ═══════════════════════════════════════════════════════
  // PROCESS PAYMENT — mark billing as PAID
  // Route:  PATCH /api/billing/:id/pay
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  //         (needs billing→update permission)
  // ═══════════════════════════════════════════════════════
  async processPayment(
    id: number,
    dto: { paymentMethod: string },
  ) {

    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: { booking: { include: { guest: true, room: true } } },
    });

    if (!billing) {
      throw new NotFoundException(`Billing record with id ${id} not found`);
    }

    // Cannot pay an already paid bill
    if (billing.paymentStatus === 'PAID') {
      throw new ConflictException(
        'This bill has already been paid',
      );
    }

    // Cannot pay a refunded bill
    if (billing.paymentStatus === 'REFUNDED') {
      throw new ConflictException(
        'This bill has been refunded',
      );
    }

    const validMethods = ['cash', 'card', 'upi'];
    if (!validMethods.includes(dto.paymentMethod)) {
      throw new ConflictException(
        `Invalid payment method. Use: ${validMethods.join(', ')}`,
      );
    }

    // Mark as paid with timestamp
    const updated = await this.prisma.billing.update({
      where: { id },
      data: {
        paymentStatus:  'PAID',
        paymentMethod:  dto.paymentMethod,
        paidAt:         new Date(),
      },
      include: {
        booking: {
          include: { guest: true, room: true },
        },
      },
    });

    return {
      message: `Payment of ₹${updated.totalAmount} received via ${dto.paymentMethod}`,
      billing: updated,
    };
  }

  // ═══════════════════════════════════════════════════════
  // APPLY DISCOUNT
  // Route:  PATCH /api/billing/:id/discount
  // Access: SUPER_ADMIN, ADMIN only
  // ═══════════════════════════════════════════════════════
  async applyDiscount(
    id: number,
    dto: { discount: number },
    requestingUser: { id: number; role: string },
  ) {

    // Only Super Admin and Admin can apply discounts
    if (
      requestingUser.role !== 'SUPER_ADMIN' &&
      requestingUser.role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Only Super Admin or Admin can apply discounts.',
      );
    }

    const billing = await this.prisma.billing.findUnique({
      where: { id },
    });

    if (!billing) {
      throw new NotFoundException(`Billing record with id ${id} not found`);
    }

    if (billing.paymentStatus === 'PAID') {
      throw new ConflictException(
        'Cannot apply discount to a paid bill',
      );
    }

    if (dto.discount < 0 || dto.discount > Number(billing.amount)) {
      throw new ConflictException(
        `Discount must be between 0 and ${billing.amount}`,
      );
    }

    // Recalculate total with discount
    const amount        = Number(billing.amount);
    const tax           = Number(billing.tax);
    const newTotal      = Number(
      (amount - dto.discount + tax).toFixed(2),
    );

    const updated = await this.prisma.billing.update({
      where: { id },
      data: {
        discount:    dto.discount,
        totalAmount: newTotal,
      },
    });

    return {
      message: `Discount of ₹${dto.discount} applied successfully`,
      billing: updated,
    };
  }

  // ═══════════════════════════════════════════════════════
  // REFUND BILLING
  // Route:  PATCH /api/billing/:id/refund
  // Access: SUPER_ADMIN, ADMIN only
  // ═══════════════════════════════════════════════════════
  async refund(
    id: number,
    requestingUser: { id: number; role: string },
  ) {

    if (
      requestingUser.role !== 'SUPER_ADMIN' &&
      requestingUser.role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Only Super Admin or Admin can process refunds.',
      );
    }

    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: { booking: { include: { guest: true } } },
    });

    if (!billing) {
      throw new NotFoundException(`Billing record with id ${id} not found`);
    }

    if (billing.paymentStatus !== 'PAID') {
      throw new ConflictException(
        'Only paid bills can be refunded',
      );
    }

    const updated = await this.prisma.billing.update({
      where: { id },
      data:  { paymentStatus: 'REFUNDED' },
    });

    return {
      message: `Refund of ₹${billing.totalAmount} processed for ${billing.booking.guest.name}`,
      billing: updated,
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET REVENUE SUMMARY — dashboard stats
  // Route:  GET /api/billing/summary
  // Access: SUPER_ADMIN, ADMIN only
  // ═══════════════════════════════════════════════════════
  async getSummary() {

    const all = await this.prisma.billing.findMany({
      include: { booking: true },
    });

    // Calculate stats
    const totalRevenue = all
      .filter(b => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const pendingRevenue = all
      .filter(b => b.paymentStatus === 'UNPAID')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const totalRefunded = all
      .filter(b => b.paymentStatus === 'REFUNDED')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const totalBookings  = all.length;
    const paidCount      = all.filter(b => b.paymentStatus === 'PAID').length;
    const unpaidCount    = all.filter(b => b.paymentStatus === 'UNPAID').length;
    const refundedCount  = all.filter(b => b.paymentStatus === 'REFUNDED').length;

    return {
      totalRevenue:    Number(totalRevenue.toFixed(2)),
      pendingRevenue:  Number(pendingRevenue.toFixed(2)),
      totalRefunded:   Number(totalRefunded.toFixed(2)),
      totalBookings,
      paidCount,
      unpaidCount,
      refundedCount,
    };
  }
}