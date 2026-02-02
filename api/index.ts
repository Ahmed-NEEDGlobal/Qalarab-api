import { handle } from 'hono/vercel';
import createApp from '../src/lib/create-app';
import configureOpenAPI from '../src/lib/configure-open-api';
import routes from '../src/routes';
import { auth } from '../src/lib/authentication/auth';

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

export default handle(app);
