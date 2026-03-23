// src/bookings/bookings.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateBookingDto {
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestIdProof?: string;
  guestAddress?: string;
  roomId: number;
  checkIn: string;   // ISO date string e.g. "2026-04-01"
  checkOut: string;  // ISO date string e.g. "2026-04-05"
  notes?: string;
}

export class UpdateBookingDto {
  notes?: string;
  checkIn?: string;
  checkOut?: string;
}

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // CREATE BOOKING
  // Route:  POST /api/bookings
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  //         (needs bookings→create permission)
  //
  // Steps:
  //   1. Find or create guest
  //   2. Check room is available
  //   3. Check no overlapping bookings
  //   4. Create booking
  //   5. Change room status to OCCUPIED
  //   6. Create billing record automatically
  // ═══════════════════════════════════════════════════════
  async create(
    dto: CreateBookingDto,
    requestingUser: { id: number; role: string },
  ) {

    // STEP 1 — Find or create guest by phone number
    let guest = await this.prisma.guest.findFirst({
      where: { phone: dto.guestPhone },
    });

    if (!guest) {
      // New guest — create their record
      guest = await this.prisma.guest.create({
        data: {
          name: dto.guestName,
          phone: dto.guestPhone,
          email: dto.guestEmail ?? null,
          idProof: dto.guestIdProof ?? null,
          address: dto.guestAddress ?? null,
        },
      });
    }

    // STEP 2 — Check room exists and is active
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${dto.roomId} not found`);
    }

    if (!room.isActive) {
      throw new ConflictException(
        `Room ${room.roomNumber} is not active`,
      );
    }

    if (room.status === 'MAINTENANCE') {
      throw new ConflictException(
        `Room ${room.roomNumber} is under maintenance`,
      );
    }

    if (room.status === 'OCCUPIED') {
      throw new ConflictException(
        `Room ${room.roomNumber} is already occupied`,
      );
    }

    // STEP 3 — Parse and validate dates
    const checkInDate  = new Date(dto.checkIn);
    const checkOutDate = new Date(dto.checkOut);
    const today        = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      throw new BadRequestException(
        'Check-in date cannot be in the past',
      );
    }

    if (checkOutDate <= checkInDate) {
      throw new BadRequestException(
        'Check-out date must be after check-in date',
      );
    }

    // STEP 4 — Check no overlapping bookings for this room
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        roomId: dto.roomId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        AND: [
          { checkIn:  { lt: checkOutDate } },
          { checkOut: { gt: checkInDate  } },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Room ${room.roomNumber} is already booked for these dates`,
      );
    }

    // STEP 5 — Calculate total amount
    // Number of nights × room price per night
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime())
      / (1000 * 60 * 60 * 24),
    );
    const totalAmount = Number(room.price) * nights;

    // STEP 6 — Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        guestId:     guest.id,
        roomId:      dto.roomId,
        userId:      requestingUser.id, // staff who made the booking
        checkIn:     checkInDate,
        checkOut:    checkOutDate,
        totalAmount,
        status:      'CONFIRMED',
        notes:       dto.notes ?? null,
      },
      include: {
        guest: true,
        room:  true,
        user:  {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // STEP 7 — Change room status to OCCUPIED
    await this.prisma.room.update({
      where: { id: dto.roomId },
      data:  { status: 'OCCUPIED' },
    });

    // STEP 8 — Auto-create billing record
    const tax      = totalAmount * 0.18; // 18% GST
    const billing  = await this.prisma.billing.create({
      data: {
        bookingId:     booking.id,
        amount:        totalAmount,
        tax:           Number(tax.toFixed(2)),
        discount:      0,
        totalAmount:   Number((totalAmount + tax).toFixed(2)),
        paymentStatus: 'UNPAID',
      },
    });

    return {
      message: `Booking created successfully for ${guest.name}`,
      booking: {
        ...booking,
        nights,
        billing,
      },
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET ALL BOOKINGS — filtered by role
  // Route:  GET /api/bookings
  // Access: All authenticated users
  //
  // SUPER_ADMIN → all bookings
  // ADMIN       → all bookings in their branch
  // MANAGER     → bookings made by them or their users
  // USER        → only their own bookings
  // ═══════════════════════════════════════════════════════
  async findAll(
    requestingUser: { id: number; role: string },
    filters: { status?: string; roomId?: number },
  ) {

    const where: any = {};

    // Apply status filter
    if (filters.status) where.status = filters.status;
    if (filters.roomId) where.roomId = Number(filters.roomId);

    // Filter by role — each role sees different bookings
    if (requestingUser.role === 'MANAGER') {
      // Manager sees bookings made by themselves + their users
      const myUserIds = await this.prisma.user.findMany({
        where: { createdBy: requestingUser.id },
        select: { id: true },
      });
      const ids = [requestingUser.id, ...myUserIds.map(u => u.id)];
      where.userId = { in: ids };
    }

    if (requestingUser.role === 'USER') {
      // User only sees their own bookings
      where.userId = requestingUser.id;
    }

    // SUPER_ADMIN and ADMIN see all — no userId filter

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        guest:   true,
        room:    true,
        billing: true,
        user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: bookings.length,
      bookings,
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET SINGLE BOOKING
  // Route:  GET /api/bookings/:id
  // ═══════════════════════════════════════════════════════
  async findOne(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        guest:   true,
        room:    true,
        billing: true,
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    return booking;
  }

  // ═══════════════════════════════════════════════════════
  // CHECK IN
  // Route:  PATCH /api/bookings/:id/checkin
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  // Changes booking status to CHECKED_IN
  // ═══════════════════════════════════════════════════════
  async checkIn(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Cannot check in. Booking status is ${booking.status}`,
      );
    }

    // Update booking status to CHECKED_IN
    const updated = await this.prisma.booking.update({
      where: { id },
      data:  { status: 'CHECKED_IN' },
      include: { guest: true, room: true },
    });

    return {
      message: `Guest ${updated.guest.name} checked in to room ${updated.room.roomNumber}`,
      booking: updated,
    };
  }

  // ═══════════════════════════════════════════════════════
  // CHECK OUT
  // Route:  PATCH /api/bookings/:id/checkout
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  // Changes booking to CHECKED_OUT + room back to AVAILABLE
  // ═══════════════════════════════════════════════════════
  async checkOut(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: true, guest: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    if (booking.status !== 'CHECKED_IN') {
      throw new ConflictException(
        `Cannot check out. Booking status is ${booking.status}`,
      );
    }

    // Update booking to CHECKED_OUT
    const updated = await this.prisma.booking.update({
      where: { id },
      data:  { status: 'CHECKED_OUT' },
      include: { guest: true, room: true, billing: true },
    });

    // Set room back to AVAILABLE for next guest
    await this.prisma.room.update({
      where: { id: booking.roomId },
      data:  { status: 'AVAILABLE' },
    });

    return {
      message: `Guest ${updated.guest.name} checked out from room ${updated.room.roomNumber}`,
      booking: updated,
    };
  }

  // ═══════════════════════════════════════════════════════
  // CANCEL BOOKING
  // Route:  PATCH /api/bookings/:id/cancel
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  // ═══════════════════════════════════════════════════════
  async cancel(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { guest: true, room: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
      throw new ConflictException(
        `Booking is already ${booking.status}`,
      );
    }

    // Cancel booking
    const updated = await this.prisma.booking.update({
      where: { id },
      data:  { status: 'CANCELLED' },
    });

    // If room was occupied — set back to AVAILABLE
    if (booking.room.status === 'OCCUPIED') {
      await this.prisma.room.update({
        where: { id: booking.roomId },
        data:  { status: 'AVAILABLE' },
      });
    }

    return {
      message: `Booking for ${booking.guest.name} has been cancelled`,
      booking: updated,
    };
  }
}