# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based API server built with Hono, providing media management, authentication, and background job processing. The application uses SurrealDB for data storage, Cloudflare R2 for media storage, BullMQ/Redis for job queuing, and Better Auth for authentication.

## Project Schema Files

The project includes SurrealDB schema files in the root directory:
- **`schema.surql`** - Better Auth tables (auto-generated)
- **`schema-media.surql`** - Media management tables (media, upload_tracking)
- **`SCHEMA_SETUP.md`** - Comprehensive guide for applying schemas

To set up the database schema, see `SCHEMA_SETUP.md` for detailed instructions.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to dist/
npm start            # Run production build from dist/
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run prettier-format  # Alternative format command
npm test             # Run tests with Vitest
npm test:watch       # Run tests in watch mode
```

### Background Jobs & Queue Management
```bash
# Queue monitoring and management
npm run queue:worker    # Start BullMQ worker to process queued jobs
npm run queue:stats     # View queue statistics
npm run queue:dashboard # Start web dashboard for queue monitoring
npm run queue:retry     # Retry failed jobs

# Dead Letter Queue (DLQ) management
npm run dlq:stats       # View DLQ statistics
npm run dlq:list        # List failed jobs in DLQ
npm run dlq:retry       # Retry jobs from DLQ
npm run dlq:details     # View detailed job information
npm run dlq:monitor     # Monitor DLQ in real-time
npm run dlq:dashboard   # Start DLQ web dashboard
npm run dlq:cleanup     # Clean up old DLQ entries

# Redis management (Unix/Linux only)
npm run redis:start     # Start Redis server
npm run redis:stop      # Stop Redis server
npm run redis:status    # Check Redis status
npm run redis:cli       # Open Redis CLI
npm run redis:logs      # View Redis logs
npm run redis:memory    # Check Redis memory usage
npm run redis:monitor   # Monitor Redis commands
npm run redis:slowlog   # View slow Redis queries
```

### Data Indexing & Search
```bash
npm run index:search    # Index data for search (Meilisearch)
npm run index:space     # Index space-specific data
npm run index:env       # Index environment data
```

### Version Management & Changelog
```bash
npm run commit          # Interactive commit with commitizen
npm run version         # Generate changelog and add to git
npm run version:major   # Bump major version
npm run version:minor   # Bump minor version
npm run version:patch   # Bump patch version
npm run release         # Standard version release
npm run release:major   # Release major version
npm run release:minor   # Release minor version
npm run release:patch   # Release patch version
npm run release:alpha   # Release alpha version
npm run release:beta    # Release beta version
npm run changelog       # Generate full changelog
```

## Architecture Overview

### Core Framework & Routing
- **Framework**: Hono with OpenAPI support via `@hono/zod-openapi`
- **Entry Point**: `src/app.ts` - Sets up server, routes, and event handlers
- **App Factory**: `src/lib/create-app.ts` - Creates configured Hono app with middleware
- **Routes**: All API routes are versioned and mounted under `/api/`
  - Routes are organized in `src/routes/` with each domain having its own directory
  - Example structure: `src/routes/media/` contains `routes.ts`, `handlers.ts`, `schemas.ts`

### API Versioning Strategy
The API supports multiple versioning methods:
1. **Header-based**: `API-Version: 1.1` or `Accept-Version: 1.1`
2. **Query parameter**: `?version=1.1`
3. **Accept header**: `Accept: application/vnd.techstudio.v1+json`
4. **Path-based**: `/api/v1/...` (explicit versioning)

Version detection is handled by `apiVersionMiddleware` in `src/middlewares/api-version.middleware.ts`.

### Database Layer
- **Database**: SurrealDB (multi-tenant capable)
- **Connection Management**: `src/lib/surrealdb.ts` handles connection setup
- **Multi-DB Support**: `src/lib/surrealdb-multi.ts` for managing multiple database connections
- **Database Middleware**: `src/middlewares/database.middleware.ts` attaches DB to context
- **Schema Files**:
  - `schema.surql` - Better Auth tables
  - `schema-media.surql` - Media management tables
  - See `SCHEMA_SETUP.md` for setup instructions
- **Configuration**:
  - Namespaces and databases are configured via env vars (`MAIN_NS`, `MAIN_DB`, `ORG_NS`)
  - Connection uses WebSocket protocol with token auth (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`)
  - **IMPORTANT**: Media service now uses `env.MAIN_NS` and `env.MAIN_DB` instead of hardcoded values

### Authentication System
- **Library**: Better Auth with SurrealDB adapter
- **Configuration**: `src/lib/authentication/auth.ts`
- **Features**:
  - Email/password authentication
  - Social providers (Google)
  - Phone number verification with OTP
  - Username support
  - Two-factor authentication
  - Anonymous sessions
  - Admin roles with access control
  - Expo mobile app support
- **Middleware**: `src/middlewares/better-auth.middleware.ts` handles auth context
- **Permissions**: `src/lib/authentication/permissions.ts` defines role-based access control
- **Custom Plugin**: `needx-better-auth-helper` provides additional helper functions

### Event System & Background Jobs
- **Queue System**: BullMQ with Redis backend
- **Event Manager**: `src/lib/events/bullmq-manager.ts` - Centralized event handling
  - Manages multiple queues with different priorities
  - Supports immediate and queued event processing
  - Automatic retry with backoff strategies
- **Event Types**: Defined in `src/lib/events/bullmq-types.ts`
- **Event Handlers**: Registered in `src/lib/events/handlers.ts`
- **Middleware**: `src/middlewares/bullmq.middleware.ts` provides event emitter to routes
- **Background Jobs**: Located in `src/jobs/`
  - `upload-cleanup.job.ts` - Cleans expired upload tracking records (runs hourly)
  - `image-processing.job.ts` - Generates image variants after upload
  - Job initialization happens in `src/jobs/index.ts`

### Media Management System
The media system follows a **3-step upload flow** with presigned URLs:

1. **Initiate Upload**: Request presigned URL from server
2. **Upload to R2**: Client uploads directly to Cloudflare R2 using presigned URL
3. **Confirm Upload**: Notify server of successful upload, triggers processing

**Key Components**:
- **Routes**: `src/routes/media/routes.ts` - OpenAPI route definitions
- **Handlers**: `src/routes/media/handlers.ts` - Request handling logic
- **Service**: `src/services/media/media.service.ts` - Business logic
- **Schemas**: `src/routes/media/schemas.ts` - Zod validation schemas
- **Storage**: `src/lib/storage/r2-client.ts` - Cloudflare R2 client
- **Processing**: `src/lib/storage/image-processor.ts` - Image variant generation
- **Documentation**: `src/routes/media/README.md` - Complete API documentation

**Image Processing**:
- Generates 4 variants: thumbnail (150x150), medium (300x300), large (600x600), original (1200x1200)
- Converts to WebP format for optimization
- Extracts dominant colors from images
- Processing happens asynchronously via BullMQ job queue

**Upload Tracking**:
- Tracks upload state: pending → uploaded → confirmed
- Expires uploads after 1 hour (configurable)
- Cleanup job removes expired uploads and orphaned files

### Middleware Stack
Applied in order (from `src/lib/create-app.ts`):
1. **serveEmojiFavicon** - Serves favicon
2. **pinoLogger** - Request logging with Pino
3. **cors** - CORS configuration
4. **requestIdMiddleware** - Generates unique request IDs
5. **databaseMiddleware** - Attaches DB connection to context
6. **apiVersionMiddleware** - API version detection (only on `/api/*`)
7. **registerMetrics** - Prometheus metrics
8. **authAppMiddleware** - Better Auth integration
9. **bullMQMiddleware** - Event system integration

### Path Aliases
TypeScript path aliases are configured in `tsconfig.json`:
- `@/*` maps to `./src/*`
- Use `tsc-alias` after compilation to resolve aliases in output

### Response Patterns
All API responses follow a standardized format via `ApiResponseHelper` (`src/lib/api-response.ts`):
```typescript
// Success response
{
  "success": true,
  "data": { ... }
}

// Error response
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### Environment Configuration
Environment variables are validated using Zod schema in `src/env.ts`. Required variables include:
- Database: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- Namespaces: `MAIN_NS`, `MAIN_DB`, `ORG_NS`
- JWT: `JWT_SECRET`, `JWT_EXPIRES_IN`
- Media/R2: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL`, `MEDIA_CDN_URL`
- Redis: `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`
- Better Auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- Search: `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`

## Key Implementation Patterns

### Adding a New Route Module
When adding a new feature domain (e.g., "products"):

1. Create directory structure in `src/routes/products/`:
   - `index.ts` - Export router
   - `routes.ts` - OpenAPI route definitions with Zod schemas
   - `handlers.ts` - Handler implementations
   - `schemas.ts` - Zod validation schemas
   - `README.md` - API documentation (optional but recommended)

2. Define routes using `@hono/zod-openapi`:
   ```typescript
   import { createRoute } from '@hono/zod-openapi';
   import { createRouter } from '@/lib/create-app';

   const router = createRouter();

   const getProductRoute = createRoute({
     method: 'get',
     path: '/products/{id}',
     tags: ['Products'],
     request: {
       params: z.object({ id: z.string() }),
     },
     responses: {
       200: { /* ... */ },
     },
   });

   router.openapi(getProductRoute, handler);
   ```

3. Mount in `src/routes/index.ts`:
   ```typescript
   import productsRoutes from './products';
   router.route('/', productsRoutes);
   ```

### Working with the Database
```typescript
// Get DB from context (middleware attaches it)
const db = c.get('db');

// Query with parameters
const result = await db.query(
  'SELECT * FROM users WHERE email = $email',
  { email: 'user@example.com' }
);

// Create records
await db.create('users', {
  email: 'user@example.com',
  name: 'John Doe'
});
```

### Emitting Events
Events can be processed immediately or queued:

```typescript
// Queue event for background processing
const jobId = await emitEvent(
  c,
  'user:created',
  { userId: 'user123', email: 'user@example.com' },
  {
    priority: 'normal',
    maxAttempts: 3
  }
);

// Process immediately (synchronous)
await emitEvent(
  c,
  'notification:email',
  { to: 'user@example.com', subject: 'Welcome' },
  { immediate: true }
);
```

### Creating Background Jobs
Follow the pattern in `src/jobs/`:

1. Define queue configuration in `src/lib/events/bullmq-types.ts`
2. Create job file with:
   - `createQueue()` - Creates BullMQ queue
   - `createWorker()` - Creates worker to process jobs
   - Job processing logic
3. Register in `src/jobs/index.ts` for initialization

### Accessing Better Auth
```typescript
// In routes - get session from context
const user = c.get('user');
if (!user?.id) {
  return ApiResponseHelper.unauthorized(c, 'Authentication required');
}

// Use auth API directly
const session = await auth.api.getSession({
  headers: c.req.raw.headers,
});
```

## Media Route File Structure Reference

When creating new feature modules similar to the media system, follow this structure:

```
src/routes/media/
├── index.ts        # Exports the router
├── routes.ts       # OpenAPI route definitions
├── handlers.ts     # Route handler implementations
├── schemas.ts      # Zod schemas for validation
└── README.md       # Complete API documentation

src/services/media/
└── media.service.ts  # Business logic and database operations

src/lib/storage/
├── r2-client.ts      # Storage client (R2/S3)
└── image-processor.ts # Image processing utilities
```

## Important Notes

- **Never hardcode credentials** - All sensitive data must use environment variables
- **Always validate input** - Use Zod schemas for all request validation
- **Use path aliases** - Import with `@/` instead of relative paths
- **Error handling** - Use `ApiResponseHelper` for consistent responses
- **Database queries** - Always use parameterized queries to prevent injection
- **Event-driven** - Emit events for async operations instead of blocking
- **Request tracking** - Request IDs are automatically generated for all requests
- **API versioning** - Always consider backward compatibility when modifying APIs
- **Background jobs** - Use BullMQ for long-running or scheduled tasks
- **Image uploads** - Use the 3-step presigned URL flow for efficient uploads
