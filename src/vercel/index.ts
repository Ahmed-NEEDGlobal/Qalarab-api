import { handle } from 'hono/vercel';

// Import the configured app from src
import app from '../app';

export default handle(app);
