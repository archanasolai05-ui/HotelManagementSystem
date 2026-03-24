// src/billing/billing.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // ── Build shared "where" clause based on role ──────────────────────
  private async buildWhereForUser(requestingUser: any, extra: any = {}) {
    const where: any = { ...extra };

    if (requestingUser.role === 'MANAGER') {
      // Include billings from bookings made by the manager OR any staff under them
      const myUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { createdBy: requestingUser.id },   // staff created by this manager
            { id: requestingUser.id },           // the manager themselves
          ],
        },
        select: { id: true },
      });
      const ids = myUsers.map((u: any) => u.id);
      where.booking = { userId: { in: ids } };
    }

    if (requestingUser.role === 'USER') {
      // Staff can only see their own bookings' billings
      where.booking = { userId: requestingUser.id };
    }

    // SUPER_ADMIN and ADMIN see everything — no filter
    return where;
  }

  async findAll(requestingUser: any, filters: any) {
    const extra: any = {};
    if (filters.paymentStatus) {
      extra.paymentStatus = filters.paymentStatus;
    }

    const where = await this.buildWhereForUser(requestingUser, extra);

    const billings = await this.prisma.billing.findMany({
      where,
      include: {
        booking: {
          include: {
            guest: true,
            room:  true,
            user:  { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = billings
      .filter(b => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const unpaidCount = billings.filter(b => b.paymentStatus === 'UNPAID').length;

    return {
      total: billings.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      unpaidCount,
      billings,
    };
  }

  async findOne(id: number) {
    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            guest: true,
            room:  true,
            user:  { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!billing) {
      throw new NotFoundException(`Billing record ${id} not found`);
    }

    return billing;
  }

  async findByBooking(bookingId: number) {
    const billing = await this.prisma.billing.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: { guest: true, room: true },
        },
      },
    });

    if (!billing) {
      throw new NotFoundException(`No billing for booking ${bookingId}`);
    }

    return billing;
  }

  async processPayment(id: number, dto: any) {
    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: { booking: { include: { guest: true, room: true } } },
    });

    if (!billing) throw new NotFoundException(`Billing ${id} not found`);
    if (billing.paymentStatus === 'PAID') throw new ConflictException('Already paid');
    if (billing.paymentStatus === 'REFUNDED') throw new ConflictException('Already refunded');

    const validMethods = ['cash', 'card', 'upi'];
    if (!validMethods.includes(dto.paymentMethod)) {
      throw new ConflictException(`Invalid method. Use: ${validMethods.join(', ')}`);
    }

    const updated = await this.prisma.billing.update({
      where: { id },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: dto.paymentMethod,
        paidAt:        new Date(),
      },
      include: { booking: { include: { guest: true, room: true } } },
    });

    return {
      message: `Payment of ₹${updated.totalAmount} received via ${dto.paymentMethod}`,
      billing: updated,
    };
  }

  async applyDiscount(id: number, dto: any, requestingUser: any) {
    if (requestingUser.role !== 'SUPER_ADMIN' && requestingUser.role !== 'ADMIN') {
      throw new ForbiddenException('Only Super Admin or Admin can apply discounts.');
    }

    const billing = await this.prisma.billing.findUnique({ where: { id } });
    if (!billing) throw new NotFoundException(`Billing ${id} not found`);
    if (billing.paymentStatus === 'PAID') throw new ConflictException('Cannot discount a paid bill');

    const amount   = Number(billing.amount);
    const tax      = Number(billing.tax);
    const newTotal = Number((amount - dto.discount + tax).toFixed(2));

    const updated = await this.prisma.billing.update({
      where: { id },
      data: { discount: dto.discount, totalAmount: newTotal },
    });

    return {
      message: `Discount of ₹${dto.discount} applied`,
      billing: updated,
    };
  }

  async refund(id: number, requestingUser: any) {
    if (requestingUser.role !== 'SUPER_ADMIN' && requestingUser.role !== 'ADMIN') {
      throw new ForbiddenException('Only Super Admin or Admin can process refunds.');
    }

    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: { booking: { include: { guest: true } } },
    });

    if (!billing) throw new NotFoundException(`Billing ${id} not found`);
    if (billing.paymentStatus !== 'PAID') throw new ConflictException('Only paid bills can be refunded');

    const updated = await this.prisma.billing.update({
      where: { id },
      data:  { paymentStatus: 'REFUNDED' },
    });

    return {
      message: `Refund of ₹${billing.totalAmount} processed for ${billing.booking.guest.name}`,
      billing: updated,
    };
  }

  // ── Summary scoped to the requesting user's role ───────────────────
  async getSummary(requestingUser: any) {
    const where = await this.buildWhereForUser(requestingUser);

    const all = await this.prisma.billing.findMany({
      where,
      include: { booking: true },
    });

    const totalRevenue   = all.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + Number(b.totalAmount), 0);
    const pendingRevenue = all.filter(b => b.paymentStatus === 'UNPAID').reduce((s, b) => s + Number(b.totalAmount), 0);
    const totalRefunded  = all.filter(b => b.paymentStatus === 'REFUNDED').reduce((s, b) => s + Number(b.totalAmount), 0);

    return {
      totalRevenue:   Number(totalRevenue.toFixed(2)),
      pendingRevenue: Number(pendingRevenue.toFixed(2)),
      totalRefunded:  Number(totalRefunded.toFixed(2)),
      totalBookings:  all.length,
      paidCount:      all.filter(b => b.paymentStatus === 'PAID').length,
      unpaidCount:    all.filter(b => b.paymentStatus === 'UNPAID').length,
      refundedCount:  all.filter(b => b.paymentStatus === 'REFUNDED').length,
    };
  }
}