import { serve } from '@hono/node-server';
import { createServer } from 'http';
import createApp from './lib/create-app';
import configureOpenAPI from './lib/configure-open-api';
import env from './env';
import { extractVersionFromAcceptHeader } from './lib/utils';
import { ApiResponseHelper } from './lib/api-response';
import routes from './routes';
import { auth } from './lib/authentication/auth';

const app = createApp();

configureOpenAPI(app);

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));
app.get('/test', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return c.json({ session });
});

// Mount application routes
app.route('/api', routes);

// Version-aware routing for /api/* (without duplicating routes)
app.all('/api/*', async (c, next) => {
  const path = c.req.path;

  // If it's already /api/v1/*, let it pass through
  if (path.startsWith('/api/v1/')) {
    return next();
  }

  // For /api/* without version, determine version from headers/query
  const version =
    c.req.header('API-Version') ||
    c.req.header('Accept-Version') ||
    c.req.query('version') ||
    extractVersionFromAcceptHeader(c) ||
    '1.0';

  // Redirect to versioned endpoint
  const versionedPath = `/api/v${version.replace('.', '_')}${path.replace('/api', '')}`;
  return c.redirect(versionedPath, 302);
});

// Event queue status route for monitoring with version info

// Start server
const port = parseInt(env.PORT);
console.log(`Starting techstudio API server on port ${port}...`);

serve(
  {
    fetch: app.fetch,
    port,
    createServer,
  },
  (info) => {
    console.log(`✅ Server started on port ${info.port}`);
    console.log(`📚 API documentation: http://localhost:${info.port}/reference`);
    console.log(`🏥 Health check: http://localhost:${info.port}/health`);
    console.log(`📊 Queue stats: http://localhost:${info.port}/queue-stats`);
    console.log(`🔧 Test events: http://localhost:${info.port}/test-event`);

    console.log(`\n🔄 API Versioning Examples:`);
    console.log(
      `  Header:  curl -H "API-Version: 1.1" http://localhost:${info.port}/api/authentication/signin`
    );
    console.log(
      `  Query:   curl "http://localhost:${info.port}/api/authentication/signin?version=1.1"`
    );
    console.log(
      `  Accept:  curl -H "Accept: application/vnd.techstudio.v1+json" http://localhost:${info.port}/api/authentication/signin`
    );
    console.log(`  Path:    curl http://localhost:${info.port}/api/v1/authentication/signin`);

    console.log(`\n📖 API Version Info: http://localhost:${info.port}/api/version`);
    console.log(`📈 Metrics: http://localhost:${info.port}/metrics`);
  }
);

export default app;
