// src/lib/types.ts
import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import { Schema } from 'hono';
import { auth } from './authentication/auth';

// =====================
// APP BINDINGS
// =====================

export interface AppBindings {
  Variables: {
    // JWT authentication - use session for full context, user for simplified access
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
    requestId: string;
    apiVersion: string;

    // Database connection (SurrealDB)
    db: import('surrealdb').Surreal;

    // Organization context
    organizationMember?: any;
    activeOrganizationId?: string;
  };
}

// =====================
// APP TYPES
// =====================

export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;

// =====================
// API RESPONSE TYPES
// =====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: PaginationMeta;
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
