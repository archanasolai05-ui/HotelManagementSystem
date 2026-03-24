// src/rooms/rooms.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateRoomDto {
  roomNumber: string;
  type: string;        // 'Single', 'Double', 'Suite', 'Deluxe'
  floor: number;
  price: number;
  description?: string;
}

export class UpdateRoomDto {
  type?: string;
  floor?: number;
  price?: number;
  description?: string;
  status?: string;     // 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'
  isActive?: boolean;
}

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // CREATE ROOM
  // ═══════════════════════════════════════════════════════
  async create(dto: CreateRoomDto) {
    const existing = await this.prisma.room.findUnique({
      where: { roomNumber: dto.roomNumber },
    });

    if (existing) {
      throw new ConflictException(
        `Room number "${dto.roomNumber}" already exists.`,
      );
    }

    const room = await this.prisma.room.create({
      data: {
        roomNumber:  dto.roomNumber,
        type:        dto.type,
        floor:       dto.floor,
        price:       dto.price,
        description: dto.description ?? null,
        status:      'AVAILABLE',
        isActive:    true,
      },
    });

    return { message: `Room ${dto.roomNumber} created successfully`, room };
  }

  // ═══════════════════════════════════════════════════════
  // GET ALL ROOMS
  // ═══════════════════════════════════════════════════════
  async findAll(filters: {
    status?: string;
    type?: string;
    floor?: number;
    isActive?: boolean;
  }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.type)   where.type   = filters.type;
    if (filters.floor)  where.floor  = Number(filters.floor);

    where.isActive = filters.isActive !== undefined ? filters.isActive : true;

    const rooms = await this.prisma.room.findMany({
      where,
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    // ── Attach active booking count to each room ───────────────────
    // Lets the frontend know if a room has future bookings even when
    // its physical status is AVAILABLE (guest not yet checked in).
    const roomsWithBookingInfo = await Promise.all(
      rooms.map(async (room) => {
        const activeBookingsCount = await this.prisma.booking.count({
          where: {
            roomId: room.id,
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
            checkOut: { gte: new Date() },
          },
        });
        const currentBooking = await this.prisma.booking.findFirst({
          where: {
            roomId: room.id,
            status: 'CHECKED_IN',
          },
          include: { guest: { select: { name: true } } },
        });
        return {
          ...room,
          activeBookingsCount,
          // Who is physically in the room right now (if anyone)
          currentGuest: currentBooking?.guest?.name ?? null,
        };
      }),
    );

    return { total: rooms.length, rooms: roomsWithBookingInfo };
  }

  // ═══════════════════════════════════════════════════════
  // GET SINGLE ROOM
  // ═══════════════════════════════════════════════════════
  async findOne(id: number) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room with id ${id} not found`);
    return room;
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE ROOM DETAILS  (price, type, floor, description)
  // ═══════════════════════════════════════════════════════
  async update(id: number, dto: UpdateRoomDto) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room with id ${id} not found`);

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        ...(dto.type        !== undefined && { type:        dto.type }),
        ...(dto.floor       !== undefined && { floor:       dto.floor }),
        ...(dto.price       !== undefined && { price:       dto.price }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status      !== undefined && { status:      dto.status as any }),
        ...(dto.isActive    !== undefined && { isActive:    dto.isActive }),
      },
    });

    return { message: `Room ${updated.roomNumber} updated successfully`, room: updated };
  }

  // ═══════════════════════════════════════════════════════
  // SOFT DELETE
  // ═══════════════════════════════════════════════════════
  async remove(id: number) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room with id ${id} not found`);

    // Block deactivation if a guest is currently checked in
    const checkedIn = await this.prisma.booking.findFirst({
      where: { roomId: id, status: 'CHECKED_IN' },
    });
    if (checkedIn) {
      throw new ConflictException(
        `Cannot deactivate Room ${room.roomNumber} — a guest is currently checked in.`,
      );
    }

    await this.prisma.room.update({
      where: { id },
      data:  { isActive: false },
    });

    return { message: `Room ${room.roomNumber} has been deactivated successfully` };
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE ROOM STATUS  (manual override by staff)
  //
  //  ── RULES ──────────────────────────────────────────────
  //
  //  OCCUPIED  →  BLOCKED for manual change.
  //    Room becomes OCCUPIED automatically when a guest checks in
  //    via the bookings flow. Staff cannot manually mark a room
  //    occupied because that would bypass the booking system.
  //
  //  AVAILABLE →  Allowed ONLY if no guest is currently checked in.
  //    Staff use this to bring a room back from MAINTENANCE.
  //    If a guest is checked in the booking system owns this transition.
  //
  //  MAINTENANCE → Allowed, but blocked if a guest is checked in.
  //    Staff use this to take a room offline for repairs.
  //    A room with future CONFIRMED bookings CAN be put in maintenance
  //    (staff responsibility to handle those bookings separately).
  //
  // ═══════════════════════════════════════════════════════
  async updateStatus(id: number, status: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room with id ${id} not found`);

    const validStatuses = ['AVAILABLE', 'MAINTENANCE'];   // OCCUPIED removed from manual list
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Manual status change only supports: ${validStatuses.join(', ')}. ` +
        `OCCUPIED is set automatically by the check-in/check-out process.`,
      );
    }

    // Block any manual change if a guest is currently physically in the room
    const checkedInBooking = await this.prisma.booking.findFirst({
      where:   { roomId: id, status: 'CHECKED_IN' },
      include: { guest: { select: { name: true } } },
    });

    if (checkedInBooking) {
      throw new ConflictException(
        `Cannot change Room ${room.roomNumber} status — ` +
        `${checkedInBooking.guest.name} is currently checked in. ` +
        `Check out the guest first via the Bookings page.`,
      );
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data:  { status: status as any },
    });

    return {
      message: `Room ${room.roomNumber} status updated to ${status}`,
      room:    updated,
    };
  }
}