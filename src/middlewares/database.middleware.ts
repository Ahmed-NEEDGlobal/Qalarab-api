import { createMiddleware } from 'hono/factory';
import { dbManager } from '@/lib/surrealdb-multi';
import env from '@/env';
import type { Surreal } from 'surrealdb';

export interface DatabaseVariables {
  mainDB: Surreal;
  orgDB?: Surreal;
}

/**
 * Database middleware using multi-database pattern
 * Each database gets its own persistent connection - NO race conditions!
 */
export const databaseMiddleware = createMiddleware<{ Variables: DatabaseVariables }>(
  async (c, next) => {
    // Get all database connections (creates them if first time, reuses if exists)
    const [mainDB] = await Promise.all([dbManager.getConnection(env.MAIN_NS, env.MAIN_DB)]);

    // Store in context - each service gets the right database
    c.set('mainDB', mainDB);

    await next();

    // NO db.close()! Connections persist and are reused
  }
);

/**
 * Helper function to get database from context with type safety
 */
export function getMainDB(c: any): Surreal {
  const db = c.get('mainDB');
  if (!db) {
    throw new Error('Core database not available in context');
  }
  return db;
}
