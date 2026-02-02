/**
 * Multi-Database Manager
 * Creates separate persistent connections for each database
 * This eliminates race conditions from namespace switching
 */

import { Surreal } from 'surrealdb';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import env from '@/env';
import axios from 'axios';

class MultiDatabaseManager {
  private connections = new Map<string, Surreal>();
  private connecting = new Map<string, Promise<Surreal>>();

  /**
   * Get a connection for a specific namespace:database combination
   * Creates the connection if it doesn't exist, reuses if it does
   */
  async getConnection(namespace: string, database: string): Promise<Surreal> {
    const key = `${namespace}:${database}`;

    // Return existing connection
    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    // Wait for connection being created
    if (this.connecting.has(key)) {
      return this.connecting.get(key)!;
    }

    // Create new connection
    const connectionPromise = this.createConnection(namespace, database, key);
    this.connecting.set(key, connectionPromise);

    try {
      const db = await connectionPromise;
      this.connections.set(key, db);
      this.connecting.delete(key);
      return db;
    } catch (error) {
      this.connecting.delete(key);
      throw error;
    }
  }

  private async createConnection(
    namespace: string,
    database: string,
    key: string
  ): Promise<Surreal> {
    const db = new Surreal();

    try {
      await db.connect(env.DATABASE_URL, {
        auth: env.DATABASE_AUTH_TOKEN,
      });

      await db.use({ namespace, database });

      return db;
    } catch (error) {
      console.error(`✗ Failed to create connection for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get or create connection for an organization-specific database
   * Database name pattern: org_{organizationId}
   */
  async getOrganizationDatabase(orgId: string): Promise<Surreal> {
    const database = `org_${orgId}`;
    return this.getConnection(env.ORG_NS, database);
  }

  /**
   * Create a new database for an organization
   * Uses SurrealDB HTTP API to execute schema
   */
  async createOrganizationDatabase(orgId: string, orgType: 'retail' | 'restaurant'): Promise<void> {
    const database = `org_${orgId}`;
    const schemaFile = orgType === 'retail' ? 'schema-retail.surql' : 'schema-restaurant.surql';

    try {
      console.log(`⚙️  Creating database via HTTP API: needexcel_organization:${database}`);

      // Read the schema file
      const schemaPath = join(process.cwd(), schemaFile);
      let schemaContent = await readFile(schemaPath, 'utf-8');

      // Replace the placeholder with actual database name
      schemaContent = schemaContent.replace(/__DATABASE_NAME__/g, database);

      const dbUrl = env.DATABASE_URL.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      const httpUrl = dbUrl.endsWith('/rpc') ? dbUrl.replace('/rpc', '/sql') : `${dbUrl}/sql`;

      // Get credentials from environment
      const authCredentials = `${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}`;

      // Create Basic Auth header
      const basicAuth = Buffer.from(authCredentials).toString('base64');

      // Execute schema via HTTP API using axios
      const response = await axios.post(httpUrl, schemaContent, {
        headers: {
          'Content-Type': 'application/octet-stream',
          Accept: 'application/json',
          Authorization: `Basic ${basicAuth}`,
          'Surreal-NS': 'needexcel_organization',
          'Surreal-DB': database,
        },
      });

      const result = response.data;
      console.log(result);
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Axios error details:');
        console.error('  Status:', error.response?.status);
        console.error('  Status Text:', error.response?.statusText);
        console.error('  Response data:', error.response?.data);
        console.error('  Request headers:', error.config?.headers);
      }
      console.error(`✗ Failed to create organization database for ${orgId}: 33`, error);
      throw error;
    }
  }

  /**
   * Execute a SurrealDB schema file on a database connection
   * Replaces __DATABASE_NAME__ placeholder with actual database name
   */
  async runSchemaFile(db: Surreal, schemaFileName: string, databaseName: string): Promise<void> {
    try {
      // Schema files are in the project root
      const schemaPath = join(process.cwd(), schemaFileName);
      let schemaContent = await readFile(schemaPath, 'utf-8');

      // Replace the placeholder with actual database name
      schemaContent = schemaContent.replace(/__DATABASE_NAME__/g, databaseName);

      // Execute the schema - SurrealDB can handle multiple statements
      await db.query(schemaContent);

      console.log(`✓ Applied schema: ${schemaFileName} for database: ${databaseName}`);
    } catch (error) {
      console.error(`✗ Failed to apply schema ${schemaFileName}:`, error);
      throw error;
    }
  }

  /**
   * Check if an organization database exists and is properly set up
   */
  async checkOrganizationDatabaseExists(orgId: string): Promise<boolean> {
    const database = `org_${orgId}`;
    const key = `needexcel_organization:${database}`;

    // If we already have a connection, the database exists
    if (this.connections.has(key)) {
      return true;
    }

    try {
      // Try to connect and query a system table
      const db = await this.getConnection('needexcel_organization', database);
      // Query to check if tables exist - check for a common table like 'media'
      const result = await db.query<Array<any>>('INFO FOR DB;');
      return result && result.length > 0;
    } catch (error) {
      console.error(`Error checking database existence for ${orgId}:`, error);
      return false;
    }
  }

  /**
   * Get statistics about current connections
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      databases: Array.from(this.connections.keys()),
      connecting: this.connecting.size,
    };
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    console.log('Closing all database connections...');

    const closePromises = Array.from(this.connections.values()).map((db) =>
      db.close().catch((err) => {
        console.error('Error closing connection:', err);
      })
    );

    await Promise.all(closePromises);

    this.connections.clear();
    this.connecting.clear();

    console.log('All database connections closed');
  }
}

// Export singleton instance
export const dbManager = new MultiDatabaseManager();

// Convenience functions for commonly used databases
export const getMainDB = () => dbManager.getConnection(env.MAIN_NS, env.MAIN_DB);

// Export for graceful shutdown
export const shutdownDatabases = () => dbManager.shutdown();
