// src/lib/create-app.ts
import { prometheus } from '@hono/prometheus';
import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultHook } from 'stoker/openapi';
import { pinoLogger } from '../middlewares/pino-logger.middleware';
import type { AppBindings, AppOpenAPI } from './types';
import { serveEmojiFavicon } from 'stoker/middlewares';
import { requestIdMiddleware } from '@/middlewares/request-id.middleware';

import { ApiResponseHelper, ErrorCodes } from './api-response';
import { cors } from 'hono/cors';
import { apiVersionMiddleware } from '@/middlewares/api-version.middleware';
import { databaseMiddleware } from '@/middlewares/database.middleware';
import { authAppMiddleware } from '@/middlewares/better-auth.middleware';

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

const { printMetrics, registerMetrics } = prometheus();

export default function createApp() {
  const app = createRouter();

  // Basic middleware
  app.use(serveEmojiFavicon('📝'));
  app.use(pinoLogger());

  app.use(
    '*', // or replace with "*" to enable cors for all routes
    cors({
      origin: ['http://localhost:3000', 'http://localhost:8081'], // replace with your origin
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    })
  );

  // Request tracking - always first for proper request ID generation
  app.use('*', requestIdMiddleware());
  app.use('*', databaseMiddleware);

  // API Versioning - applied to all API routes
  app.use('/api/*', apiVersionMiddleware());

  // Metrics
  app.use('*', registerMetrics);
  app.get('/metrics', printMetrics);

  // Authentication
  app.use('*', authAppMiddleware());

  // API Version Info Endpoint
  app.get('/api/version', (c) => {
    const currentVersion = c.get('apiVersion') || '1.0';

    return ApiResponseHelper.success(c, {
      current_version: currentVersion,
      supported_versions: ['1.0', '1.1', '2.0'],
      deprecated_versions: ['1.0'],
      latest_version: '2.0',
      version_policy: 'https://docs.techstudio.com.bd/api/versioning',
      version_header_examples: {
        header: 'API-Version: 1.1',
        query: '?version=1.1',
        accept: 'application/vnd.techstudio.v1+json',
      },
    });
  });

  // Legacy version endpoint (maintain backward compatibility)
  app.get('/version', (c) => {
    const apiVersion = c.get('apiVersion') || '1.0';

    return ApiResponseHelper.success(c, {
      version: 'v1.0.0', // App version
      api_version: apiVersion, // API version
      deprecated_warning: 'This endpoint is deprecated. Use /api/version instead.',
    });
  });

  // API Documentation redirect with version awareness
  app.get('/docs', (c) => {
    const apiVersion = c.get('apiVersion') || '1.0';
    // Redirect to version-specific docs if you have them
    return c.redirect(`/reference?version=${apiVersion}`, 302);
  });

  // Redirect root to your main site
  app.get('/', (c) => {
    return c.redirect('https://techstudio.com.bd', 302);
  });

  // OpenAPI Security Schemes
  app.openAPIRegistry.registerComponent('securitySchemes', 'AuthorizationBearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  // Enhanced 404 handler with version info
  app.notFound((c) => {
    const apiVersion = c.get('apiVersion');
    const response = {
      message: 'The requested resource was not found',
      ...(apiVersion && {
        api_version: apiVersion,
        suggestion: 'Check if you are using the correct API version',
      }),
    };

    return ApiResponseHelper.notFound(c, response.message);
  });

  // Enhanced error handler with version tracking
  app.onError((err: any, c) => {
    const apiVersion = c.get('apiVersion');

    console.error('Application Error:', {
      error: err.message,
      stack: err.stack,
      requestId: c.get('requestId'),
      path: c.req.path,
      method: c.req.method,
      apiVersion,
    });

    // Check if it's a validation error
    if (err.name === 'ZodError') {
      return ApiResponseHelper.badRequest(c, 'Validation failed', {
        issues: err.issues,
        ...(apiVersion && { api_version: apiVersion }),
      });
    }

    // API version specific error handling
    if (err.message.includes('UNSUPPORTED_API_VERSION')) {
      return ApiResponseHelper.badRequest(c, err.message, {
        supported_versions: ['1.0', '1.1', '2.0'],
        documentation: '/api/version',
      });
    }

    // Check for specific error types
    if (err.message.includes('Invalid credentials')) {
      return ApiResponseHelper.unauthorized(c, err.message);
    }

    if (err.message.includes('not found')) {
      return ApiResponseHelper.notFound(c, err.message);
    }

    if (err.message.includes('already exists')) {
      return ApiResponseHelper.conflict(c, err.message);
    }

    // Default to internal server error
    return ApiResponseHelper.internalError(c, 'An unexpected error occurred');
  });

  return app;
}
