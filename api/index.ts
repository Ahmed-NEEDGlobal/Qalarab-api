import { Hono } from 'hono';
import { handle } from 'hono/vercel';

// Import the configured app from src
import app from '../src/app';

export default handle(app);
