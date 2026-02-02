import createApp from './lib/create-app';
import configureOpenAPI from './lib/configure-open-api';
import { extractVersionFromAcceptHeader } from './lib/utils';
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

export default app;
