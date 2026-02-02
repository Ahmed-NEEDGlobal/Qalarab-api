import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
config();

// Define environment schema
const envSchema = z.object({
  PORT: z.string().default('3000'),

  // Database configuration
  DATABASE_URL: z.string(),
  DATABASE_AUTH_TOKEN: z.string(),

  DATABASE_USERNAME: z.string(),
  DATABASE_PASSWORD: z.string(),

  // Main namespace
  MAIN_NS: z.string().default('needxlife'),
  // Database names
  MAIN_DB: z.string().default('core'),
  ORG_NS: z.string().default('needexcel_organization'),

  // JWT configuration
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Media configuration
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_NAME: z.string(),
  R2_ENDPOINT: z.string(),
  R2_PUBLIC_URL: z.string(),
  MEDIA_CDN_URL: z.string(),

  // Meilisearch configuration
  MEILISEARCH_HOST: z.string(),
  MEILISEARCH_API_KEY: z.string(),

  // Socket configuration
  SOCKET_PATH: z.string().default('/socket.io'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  RESEND_API: z.string(),

  // Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_TTL: z.string().default('3600'),

  // BullMQ configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0'),

  // Queue configuration
  QUEUE_CONCURRENCY: z.string().default('5'),
  QUEUE_MAX_RETRIES: z.string().default('3'),
  QUEUE_RETRY_DELAY: z.string().default('5000'),

  // DLQ Configuration
  DLQ_R2_PREFIX: z.string().default('dlq-logs/'),
  DLQ_RETENTION_DAYS: z.string().default('90'),
  DLQ_ALERT_WEBHOOK: z.string().optional(),

  // SMS
  SMS_ENDPOINT: z.string(),
  SMS_API_KEY: z.string(),
  SMS_CUSTOMER_ID: z.string(),

  // BETTER AUTH
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.string(),

  // GOOGLE AUTH
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

export default env;
