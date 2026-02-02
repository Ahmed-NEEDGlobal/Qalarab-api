// src/middlewares/request-id.middleware.ts
import { Context, Next } from 'hono';
import { AppBindings } from '@/lib/types';

export function requestIdMiddleware() {
  return async (c: Context<AppBindings>, next: Next) => {
    // Generate or use existing request ID
    const requestId =
      c.req.header('X-Request-ID') ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Set request ID in context
    c.set('requestId', requestId);

    // Add request ID to response headers
    c.header('X-Request-ID', requestId);

    await next();
  };
}
