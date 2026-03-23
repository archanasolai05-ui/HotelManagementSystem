import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

// Usage on a route: @RequirePermission('rooms', 'create')
// Stores { module: 'rooms', action: 'create' } as metadata on that route
export const RequirePermission = (module: string, action: string) =>
  SetMetadata(PERMISSIONS_KEY, { module, action });