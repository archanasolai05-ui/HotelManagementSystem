import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Usage in controller: @CurrentUser() user: User
// Extracts the logged-in user from request.user
// request.user is set by JwtStrategy after token validation
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);