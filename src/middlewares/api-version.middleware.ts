// src/middlewares/api-version.middleware.ts
import { Context, Next } from 'hono';
import { AppBindings } from '@/lib/types';

export interface ApiVersionConfig {
  supported: string[];
  default: string;
  deprecated: string[];
}

const API_VERSION_CONFIG: ApiVersionConfig = {
  supported: ['1.0'],
  default: '1.0',
  deprecated: [],
};

export function apiVersionMiddleware(config: ApiVersionConfig = API_VERSION_CONFIG) {
  return async (c: Context<AppBindings>, next: Next) => {
    // Extract version from multiple sources (priority order)
    let version =
      c.req.header('API-Version') || // Header: API-Version: 1.1
      c.req.header('Accept-Version') || // Header: Accept-Version: 1.1
      c.req.query('version') || // Query: ?version=1.1
      extractVersionFromAcceptHeader(c) || // Accept: application/vnd.techstudio.v1+json
      config.default;

    // Normalize version (remove 'v' prefix if present)
    version = version.replace(/^v/, '');

    // Validate version
    if (!config.supported.includes(version)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_API_VERSION',
            message: `API version ${version} is not supported`,
            supported_versions: config.supported,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId'),
          },
        },
        400
      );
    }

    // Set version in context
    c.set('apiVersion', version);

    // Add version headers to response
    c.header('API-Version', version);
    c.header('API-Supported-Versions', config.supported.join(', '));

    // Add deprecation warning if applicable
    if (config.deprecated.includes(version)) {
      c.header(
        'API-Deprecation-Warning',
        `API version ${version} is deprecated. Please upgrade to a newer version.`
      );
      c.header('API-Sunset-Date', '2025-12-31'); // Set actual sunset date
    }

    await next();
  };
}

function extractVersionFromAcceptHeader(c: Context): string | null {
  const acceptHeader = c.req.header('Accept');
  if (!acceptHeader) return null;

  // Match patterns like: application/vnd.techstudio.v1+json
  const match = acceptHeader.match(/application\/vnd\.techstudio\.v(\d+(?:\.\d+)?)\+json/);
  return match ? match[1] : null;
}
