// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    // ↑ Imports AuthModule so we can use
    // JwtAuthGuard, RolesGuard, PermissionsGuard in this module
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
  // ↑ Export so other modules (Rooms, Bookings) can use UsersService
})
export class UsersModule {}