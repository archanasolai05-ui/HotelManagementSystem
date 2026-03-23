// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    // Extract directly from body object
    // This works regardless of how NestJS parses the body
    const email    = body?.email    ?? body?.['email'];
    const password = body?.password ?? body?.['password'];
    return this.authService.login({ email, password });
  }

  // POST /api/auth/register
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @Post('register')
  async register(
    @Body() body: any,
    @CurrentUser() currentUser: any,
  ) {
    return this.authService.register(
      {
        name:     body?.name,
        email:    body?.email,
        password: body?.password,
        role:     body?.role,
      },
      currentUser,
    );
  }

  // GET /api/auth/profile
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() currentUser: any) {
    return this.authService.getProfile(currentUser.id);
  }

  // PATCH /api/auth/users/:id/disable
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @Patch('users/:id/disable')
  disableUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.authService.disableUser(id, currentUser);
  }

  // PATCH /api/auth/users/:id/enable
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('users/:id/enable')
  enableUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.authService.enableUser(id, currentUser);
  }
}