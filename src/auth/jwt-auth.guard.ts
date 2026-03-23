import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Activates JWT validation on any route it is applied to
// Usage: @UseGuards(JwtAuthGuard)
// Triggers jwt.strategy.ts → validate() on every request
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}