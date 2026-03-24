// src/bookings/bookings.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateBookingDto {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestIdProof: string;
  guestAddress: string;
  roomId: number;
  checkIn: string;
  checkOut: string;
  notes: string;
}

export class UpdateBookingDto {
  notes: string;
  checkIn: string;
  checkOut: string;
}

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any, requestingUser: any) {

    // ── Find or create guest ───────────────────────────────────────────
    let guest = await this.prisma.guest.findFirst({
      where: { phone: dto.guestPhone },
    });

    if (guest) {
      // If guest exists, verify the name matches to prevent accidental association
      if (guest.name.toLowerCase() !== dto.guestName.toLowerCase()) {
        throw new ConflictException(
          `A guest with phone number ${dto.guestPhone} already exists with name "${guest.name}". ` +
          `Please use a different phone number or verify the guest details.`,
        );
      }
      // Update other details if provided
      guest = await this.prisma.guest.update({
        where: { id: guest.id },
        data: {
          email:   dto.guestEmail   || guest.email,
          idProof: dto.guestIdProof || guest.idProof,
          address: dto.guestAddress || guest.address,
        },
      });
    } else {
      // Create new guest
      guest = await this.prisma.guest.create({
        data: {
          name:    dto.guestName,
          phone:   dto.guestPhone,
          email:   dto.guestEmail   || null,
          idProof: dto.guestIdProof || null,
          address: dto.guestAddress || null,
        },
      });
    }

    // ── Check room exists ──────────────────────────────────────────────
    const room = await this.prisma.room.findUnique({
      where: { id: Number(dto.roomId) },
    });

    if (!room) throw new NotFoundException(`Room with id ${dto.roomId} not found`);
    if (!room.isActive) throw new ConflictException(`Room ${room.roomNumber} is not active`);
    if (room.status === 'MAINTENANCE') throw new ConflictException(`Room ${room.roomNumber} is under maintenance`);

    // ── Parse & validate dates ─────────────────────────────────────────
    const checkInDate  = new Date(dto.checkIn);
    const checkOutDate = new Date(dto.checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      throw new BadRequestException('Invalid check-in or check-out date');
    }
    if (checkOutDate <= checkInDate) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }

    // ── Check date-range overlap ───────────────────────────────────────
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        roomId: Number(dto.roomId),
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        AND: [
          { checkIn:  { lt: checkOutDate } },
          { checkOut: { gt: checkInDate  } },
        ],
      },
    });

    if (overlapping) {
      const existingIn  = new Date(overlapping.checkIn).toLocaleDateString('en-IN');
      const existingOut = new Date(overlapping.checkOut).toLocaleDateString('en-IN');
      throw new ConflictException(
        `Room ${room.roomNumber} is already booked from ${existingIn} to ${existingOut}. ` +
        `Please choose different dates.`,
      );
    }

    // ── Calculate amount ───────────────────────────────────────────────
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalAmount = Number(room.price) * nights;

    // ── Create booking ─────────────────────────────────────────────────
    const booking = await this.prisma.booking.create({
      data: {
        guestId:     guest.id,
        roomId:      Number(dto.roomId),
        userId:      requestingUser.id,
        checkIn:     checkInDate,
        checkOut:    checkOutDate,
        totalAmount,
        status:      'CONFIRMED',
        notes:       dto.notes || null,
      },
      include: {
        guest: true,
        room:  true,
        user:  { select: { id: true, name: true, role: true } },
      },
    });

    // ── Auto-create billing ────────────────────────────────────────────
    const tax     = totalAmount * 0.18;
    const billing = await this.prisma.billing.create({
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
      booking: { ...booking, nights, billing },
    };
  }

  // ── findAll ──────────────────────────────────────────────────────────
  async findAll(requestingUser: any, filters: any) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.roomId) where.roomId = Number(filters.roomId);

    if (requestingUser.role === 'MANAGER') {
      // Manager sees bookings made by themselves + their staff
      const myUsers = await this.prisma.user.findMany({
        where:  { createdBy: requestingUser.id },
        select: { id: true },
      });
      const ids = [requestingUser.id, ...myUsers.map((u: any) => u.id)];
      where.userId = { in: ids };
    }

    // FIX: USER (staff) now sees ALL bookings in the system
    // so they can check in/out guests regardless of who created the booking.
    // Previously: where.userId = requestingUser.id  ← only their own bookings
    // Now: no filter for USER → they see all bookings like a manager would
    // (The PermissionsGuard already ensures they have 'bookings read' permission)

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        guest:   true,
        room:    true,
        billing: true,
        user:    { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { total: bookings.length, bookings };
  }

  // ── findOne ──────────────────────────────────────────────────────────
  async findOne(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        guest:   true,
        room:    true,
        billing: true,
        user:    { select: { id: true, name: true, role: true } },
      },
    });

    if (!booking) throw new NotFoundException(`Booking with id ${id} not found`);
    return booking;
  }

  // ── checkIn ──────────────────────────────────────────────────────────
  async checkIn(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id },
      include: { room: true },
    });

    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException(`Cannot check in — status is ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where:   { id },
      data:    { status: 'CHECKED_IN' },
      include: { guest: true, room: true },
    });

    await this.prisma.room.update({
      where: { id: booking.roomId },
      data:  { status: 'OCCUPIED' },
    });

    return {
      message: `Guest ${updated.guest.name} checked in to room ${updated.room.roomNumber}`,
      booking: updated,
    };
  }

  // ── checkOut ─────────────────────────────────────────────────────────
  async checkOut(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id },
      include: { room: true, guest: true },
    });

    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    if (booking.status !== 'CHECKED_IN') {
      throw new ConflictException(`Cannot check out — status is ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where:   { id },
      data:    { status: 'CHECKED_OUT' },
      include: { guest: true, room: true, billing: true },
    });

    await this.prisma.room.update({
      where: { id: booking.roomId },
      data:  { status: 'AVAILABLE' },
    });

    return {
      message: `Guest ${updated.guest.name} checked out from room ${updated.room.roomNumber}`,
      booking: updated,
    };
  }

  // ── cancel ───────────────────────────────────────────────────────────
  async cancel(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id },
      include: { guest: true, room: true },
    });

    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
      throw new ConflictException(`Booking is already ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data:  { status: 'CANCELLED' },
    });

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

  // ── checkRoomAvailability ────────────────────────────────────────────
  async checkRoomAvailability(roomId: number, checkIn: string, checkOut: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException(`Room ${roomId} not found`);

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const conflict = await this.prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        AND: [
          { checkIn:  { lt: checkOutDate } },
          { checkOut: { gt: checkInDate  } },
        ],
      },
      select: { id: true, checkIn: true, checkOut: true, status: true },
    });

    return {
      available: !conflict,
      conflict: conflict
        ? { bookingId: conflict.id, checkIn: conflict.checkIn, checkOut: conflict.checkOut, status: conflict.status }
        : null,
    };
  }

  // ── getBookedDatesForRoom ────────────────────────────────────────────
  async getBookedDatesForRoom(roomId: number) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId,
        status:   { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        checkOut: { gte: new Date() },
      },
      select:  { id: true, checkIn: true, checkOut: true, status: true },
      orderBy: { checkIn: 'asc' },
    });

    return { roomId, bookedRanges: bookings };
  }
}