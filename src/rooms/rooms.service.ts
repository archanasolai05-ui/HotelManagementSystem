// src/rooms/rooms.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateRoomDto {
  roomNumber: string;
  type: string;       // 'Single', 'Double', 'Suite', 'Deluxe'
  floor: number;
  price: number;
  description?: string;
}

export class UpdateRoomDto {
  type?: string;
  floor?: number;
  price?: number;
  description?: string;
  status?: string;    // 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'
  isActive?: boolean;
}

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // CREATE ROOM
  // Route:  POST /api/rooms
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  //         (MANAGER needs rooms→create permission enabled)
  // ═══════════════════════════════════════════════════════
  async create(dto: CreateRoomDto) {

    // Room number must be unique
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
        roomNumber: dto.roomNumber,
        type: dto.type,
        floor: dto.floor,
        price: dto.price,
        description: dto.description ?? null,
        status: 'AVAILABLE',
        isActive: true,
      },
    });

    return {
      message: `Room ${dto.roomNumber} created successfully`,
      room,
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET ALL ROOMS
  // Route:  GET /api/rooms
  // Access: All authenticated users
  // Query filters: status, type, floor, isActive
  // ═══════════════════════════════════════════════════════
  async findAll(filters: {
    status?: string;
    type?: string;
    floor?: number;
    isActive?: boolean;
  }) {

    // Build dynamic where clause from filters
    const where: any = {};
    if (filters.status)   where.status   = filters.status;
    if (filters.type)     where.type     = filters.type;
    if (filters.floor)    where.floor    = Number(filters.floor);

    // Default — only show active rooms
    // Pass isActive=false to see inactive rooms (admin use)
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    } else {
      where.isActive = true;
    }

    const rooms = await this.prisma.room.findMany({
      where,
      orderBy: [
        { floor: 'asc' },
        { roomNumber: 'asc' },
      ],
    });

    return {
      total: rooms.length,
      rooms,
    };
  }

  // ═══════════════════════════════════════════════════════
  // GET SINGLE ROOM
  // Route:  GET /api/rooms/:id
  // Access: All authenticated users
  // ═══════════════════════════════════════════════════════
  async findOne(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }

    return room;
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE ROOM
  // Route:  PATCH /api/rooms/:id
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  //         (MANAGER needs rooms→update permission enabled)
  // ═══════════════════════════════════════════════════════
  async update(id: number, dto: UpdateRoomDto) {
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        // Only update fields that were provided in request body
        ...(dto.type        !== undefined && { type: dto.type }),
        ...(dto.floor       !== undefined && { floor: dto.floor }),
        ...(dto.price       !== undefined && { price: dto.price }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status      !== undefined && { status: dto.status as any }),
        ...(dto.isActive    !== undefined && { isActive: dto.isActive }),
      },
    });

    return {
      message: `Room ${updated.roomNumber} updated successfully`,
      room: updated,
    };
  }

  // ═══════════════════════════════════════════════════════
  // DELETE ROOM (soft delete — sets isActive = false)
  // Route:  DELETE /api/rooms/:id
  // Access: SUPER_ADMIN, ADMIN only
  // ═══════════════════════════════════════════════════════
  async remove(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }

    // Soft delete — never remove from DB
    // Preserves booking history linked to this room
    await this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      message: `Room ${room.roomNumber} has been deactivated successfully`,
    };
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE ROOM STATUS
  // Route:  PATCH /api/rooms/:id/status
  // Access: SUPER_ADMIN, ADMIN, MANAGER
  // Purpose: Quick status change — AVAILABLE / OCCUPIED / MAINTENANCE
  // ═══════════════════════════════════════════════════════
  async updateStatus(id: number, status: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }

    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'];
    if (!validStatuses.includes(status)) {
      throw new ConflictException(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: { status: status as any },
    });

    return {
      message: `Room ${room.roomNumber} status updated to ${status}`,
      room: updated,
    };
  }
}