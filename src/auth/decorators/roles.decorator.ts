// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Using string instead of Role enum
// After prisma generate — Role enum will be available
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);