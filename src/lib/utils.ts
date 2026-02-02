// src/lib/utils.ts

/**
 * Generate a unique request ID
 * @returns string - Unique request identifier
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper function for Accept header version extraction
 * @param c - Hono context
 * @returns string | null - Extracted version or null
 */
export function extractVersionFromAcceptHeader(c: any): string | null {
  const acceptHeader = c.req.header('Accept');
  if (!acceptHeader) return null;

  const match = acceptHeader.match(/application\/vnd\.techstudio\.v(\d+(?:\.\d+)?)\+json/);
  return match ? match[1] : null;
}
