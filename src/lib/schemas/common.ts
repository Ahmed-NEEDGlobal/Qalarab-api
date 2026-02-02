import { z, type ZodType } from 'zod';

// ======================
// COMMON RESPONSE SCHEMAS
// ======================

/**
 * Creates a success response schema with typed data
 * This ensures the data field is required (not optional)
 */
export function createSuccessResponse<T extends ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      timestamp: z.string(),
      requestId: z.string(),
      apiVersion: z.string().optional(),
    }),
  });
}
