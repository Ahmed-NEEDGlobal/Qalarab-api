import { Context, Next } from 'hono';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export function pinoLogger() {
  return async (c: Context, next: Next) => {
    const start = performance.now();
    await next();
    const end = performance.now();

    logger.info({
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      responseTime: `${(end - start).toFixed(2)}ms`,
    });
  };
}
