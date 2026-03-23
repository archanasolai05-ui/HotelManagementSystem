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

    // Find or create guest
    let guest = await this.prisma.guest.findFirst({
      where: { phone: dto.guestPhone },
    });

    if (!guest) {
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

    // Check room exists
    const room = await this.prisma.room.findUnique({
      where: { id: Number(dto.roomId) },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${dto.roomId} not found`);
    }

    if (!room.isActive) {
      throw new ConflictException(`Room ${room.roomNumber} is not active`);
    }

    if (room.status === 'MAINTENANCE') {
      throw new ConflictException(`Room ${room.roomNumber} is under maintenance`);
    }

    if (room.status === 'OCCUPIED') {
      throw new ConflictException(`Room ${room.roomNumber} is already occupied`);
    }

    // Parse dates
    const checkInDate  = new Date(dto.checkIn);
    const checkOutDate = new Date(dto.checkOut);
    const today        = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkOutDate <= checkInDate) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    // Check overlapping bookings
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
      throw new ConflictException(
        `Room ${room.roomNumber} is already booked for these dates`,
      );
    }

    // Calculate amount
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalAmount = Number(room.price) * nights;

    // Create booking
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

    // Set room to OCCUPIED
    await this.prisma.room.update({
      where: { id: Number(dto.roomId) },
      data:  { status: 'OCCUPIED' },
    });

    // Auto-create billing
    const tax     = totalAmount * 0.18;
    const billing = await this.prisma.billing.create({
      data: {
        bookingId:    booking.id,
        amount:       totalAmount,
        tax:          Number(tax.toFixed(2)),
        discount:     0,
        totalAmount:  Number((totalAmount + tax).toFixed(2)),
        paymentStatus: 'UNPAID',
      },
    });

    return {
      message: `Booking created successfully for ${guest.name}`,
      booking: { ...booking, nights, billing },
    };
  }

  async findAll(requestingUser: any, filters: any) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.roomId) where.roomId = Number(filters.roomId);

    if (requestingUser.role === 'MANAGER') {
      const myUsers = await this.prisma.user.findMany({
        where: { createdBy: requestingUser.id },
        select: { id: true },
      });
      const ids = [requestingUser.id, ...myUsers.map((u: any) => u.id)];
      where.userId = { in: ids };
    }

    if (requestingUser.role === 'USER') {
      where.userId = requestingUser.id;
    }

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

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    return booking;
  }

  async checkIn(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!booking) throw new NotFoundException(`Booking ${id} not found`);

    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException(`Cannot check in — status is ${booking.status}`);
    }

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

  async checkOut(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: true, guest: true },
    });

    if (!booking) throw new NotFoundException(`Booking ${id} not found`);

    if (booking.status !== 'CHECKED_IN') {
      throw new ConflictException(`Cannot check out — status is ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data:  { status: 'CHECKED_OUT' },
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

  async cancel(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
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
}