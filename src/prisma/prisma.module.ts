import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() means — register once, use everywhere
// Without this, every module (auth, rooms, bookings) would need to import PrismaModule separately
@Global()
@Module({
  providers: [PrismaService],  // makes PrismaService available inside this module
  exports: [PrismaService],    // shares it with every other module in the app
})
export class PrismaModule {}