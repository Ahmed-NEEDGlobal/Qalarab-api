import * as HttpStatusCodes from 'stoker/http-status-codes';
import { Context } from 'hono';
import type { AppBindings } from './types';
import { generateRequestId } from './utils';

// Standard API Response Interface
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

// Success Response Interface (data is required)
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    pagination?: PaginationMeta;
    timestamp: string;
    requestId: string;
  };
}

// Error Response Interface
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

// Pagination Interface
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Error Codes Enum
export enum ErrorCodes {
  // Authentication & Authorization
  INVALID_CREDENTIALS = 'AUTH_001',
  INSUFFICIENT_PERMISSIONS = 'AUTH_003',

  // Validation
  INVALID_INPUT = 'VAL_001',

  // System
  INTERNAL_ERROR = 'SYS_001',

  // Resources
  RESOURCE_NOT_FOUND = 'RES_001',
  RESOURCE_CONFLICT = 'RES_002',
}

// Enhanced Response Helper Class
export class ApiResponseHelper {
  private static generateMeta(requestId?: string): { timestamp: string; requestId: string } {
    return {
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
    };
  }

  // Success Responses
  static success<T>(c: Context<AppBindings>, data: T, status: number = HttpStatusCodes.OK) {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      meta: this.generateMeta(c.get('requestId')),
    };

    return c.json(response, status as any);
  }

  static created<T>(c: Context<AppBindings>, data: T) {
    return this.success(c, data, HttpStatusCodes.CREATED);
  }

  static noContent(c: Context<AppBindings>) {
    const response: ApiResponse = {
      success: true,
      meta: this.generateMeta(c.get('requestId')),
    };

    return c.json(response, HttpStatusCodes.NO_CONTENT as any);
  }

  // Error Responses
  static error(
    c: Context<AppBindings>,
    code: ErrorCodes,
    message: string,
    status: number,
    details?: any
  ) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: this.generateMeta(c.get('requestId')),
    };

    return c.json(response, status as any);
  }

  static badRequest(c: Context<AppBindings>, message: string = 'Bad Request', details?: any) {
    return this.error(c, ErrorCodes.INVALID_INPUT, message, HttpStatusCodes.BAD_REQUEST, details);
  }

  static unauthorized(c: Context<AppBindings>, message: string = 'Unauthorized') {
    return this.error(c, ErrorCodes.INVALID_CREDENTIALS, message, HttpStatusCodes.UNAUTHORIZED);
  }

  static forbidden(c: Context<AppBindings>, message: string = 'Forbidden') {
    return this.error(c, ErrorCodes.INSUFFICIENT_PERMISSIONS, message, HttpStatusCodes.FORBIDDEN);
  }

  static notFound(c: Context<AppBindings>, message: string = 'Resource not found') {
    return this.error(c, ErrorCodes.RESOURCE_NOT_FOUND, message, HttpStatusCodes.NOT_FOUND);
  }

  static conflict(c: Context<AppBindings>, message: string, details?: any) {
    return this.error(c, ErrorCodes.RESOURCE_CONFLICT, message, HttpStatusCodes.CONFLICT, details);
  }

  static internalError(c: Context<AppBindings>, message: string = 'Internal Server Error') {
    return this.error(c, ErrorCodes.INTERNAL_ERROR, message, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  // Paginated Response
  static paginated<T>(
    c: Context<AppBindings>,
    data: T[],
    pagination: PaginationMeta,
    status: number = HttpStatusCodes.OK
  ) {
    const response: ApiSuccessResponse<T[]> = {
      success: true,
      data,
      meta: {
        ...this.generateMeta(c.get('requestId')),
        pagination,
      },
    };

    return c.json(response, status as any);
  }
}
