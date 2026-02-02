import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { AppBindings } from './types';
import packageJSON from '../../package.json' with { type: 'json' };

export default function configureOpenAPI(app: OpenAPIHono<AppBindings>) {
  // OpenAPI specification
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: packageJSON.version,
      title: 'techstudio API',
    },
  });

  app.get(
    '/reference',
    Scalar({
      pageTitle: 'API Documentation',
      sources: [
        { url: '/doc', title: 'API' },
        // Better Auth schema generation endpoint
        { url: '/api/auth/open-api/generate-schema', title: 'Auth' },
      ],
    })
  );
}
