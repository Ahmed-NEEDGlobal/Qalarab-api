import { Context, Next } from 'hono';
import { AppBindings } from '@/lib/types';
import { ApiResponseHelper } from '@/lib/api-response';
import env from '@/env';
import { auth } from '@/lib/authentication/auth';
import { checkOrganizationSetup } from '@/services/database/setup.service';

// =====================
// TYPE DEFINITIONS
// =====================

export type Permission = {
  [resource: string]: string[];
};

export interface BetterAuthOptions {
  required?: boolean; // Whether authentication is required
  roles?: string[]; // Required roles (OR logic - user needs at least one)
  skipPaths?: string[]; // Paths to skip authentication entirely
}

export interface OrganizationAuthOptions {
  required?: boolean; // Whether organization membership is required
  permissions?: Permission; // Required permissions in the organization
  allowedRoles?: string[]; // Specific organization roles allowed
}

export function BetterAuth(options: BetterAuthOptions = {}) {
  return async (c: Context<AppBindings>, next: Next) => {
    const { required = false, roles = [], skipPaths = [] } = options;

    // Skip authentication entirely for specified paths
    const path = c.req.path;
    if (skipPaths.some((skipPath) => path.includes(skipPath))) {
      await next();
      return;
    }

    // Get session using Better Auth's built-in session management
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (env.NODE_ENV === 'development') {
      console.log('Session retrieved:', session ? `User: ${session.user.id}` : 'No session');
    }

    // If no session and authentication is not required, continue
    if (!session && !required) {
      c.set('user', null as any);
      c.set('session', null as any);
      await next();
      return;
    }

    // If no session but authentication is required
    if (!session && required) {
      return ApiResponseHelper.unauthorized(c, 'Authentication required');
    }

    // Session exists, extract user and session data
    if (session) {
      const { user, session: sessionData } = session;

      // Check if user is banned
      if (user.banned) {
        return ApiResponseHelper.forbidden(c, user.banReason || 'Account has been banned');
      }

      // Check role requirements (role is comma-separated: "user,admin")
      if (roles.length > 0) {
        const userRoleString = (user.role as string) || 'user';
        const userRoles = userRoleString.split(',').map((r: string) => r.trim());
        const hasRequiredRole = roles.some((role) => userRoles.includes(role));

        if (!hasRequiredRole) {
          if (env.NODE_ENV === 'development') {
            console.warn('Insufficient permissions:', {
              userId: user.id,
              requiredRoles: roles,
              userRoles: userRoles,
              path: c.req.path,
            });
          }

          return ApiResponseHelper.forbidden(
            c,
            `Insufficient permissions. Required roles: ${roles.join(', ')}`
          );
        }
      }

      // Set session and user data directly from Better Auth
      c.set('session', sessionData);
      c.set('user', user);

      await next();
    }
  };
}

// =====================
// CONVENIENCE MIDDLEWARE FUNCTIONS
// =====================

/**
 * Require authentication
 * User must be authenticated to access the route
 */
export const requireAuth = () => BetterAuth({ required: true });

/**
 * Optional authentication
 * Authentication is optional, but if present, will be validated
 */
export const optionalAuth = () => BetterAuth({ required: false });

/**
 * Require specific role(s)
 * User must be authenticated AND have one of the specified roles
 *
 * @param roles - Single role or array of roles (OR logic)
 */
export const requireRole = (roles: string | string[]) =>
  BetterAuth({
    required: true,
    roles: Array.isArray(roles) ? roles : [roles],
  });

/**
 * Require admin access
 * User must be authenticated AND have admin or super_admin role
 */
export const requireAdmin = () =>
  BetterAuth({
    required: true,
    roles: ['admin', 'super_admin'],
  });

/**
 * Require user role
 * User must be authenticated AND have basic user role
 */
export const requireUser = () =>
  BetterAuth({
    required: true,
    roles: ['user'],
  });

/**
 * Application-wide auth middleware
 * Applied globally but skips authentication endpoints
 */
export const authAppMiddleware = () =>
  BetterAuth({
    required: false,
    skipPaths: [
      '/api/v1/auth/',
      '/api/v1/authentication/refresh',
      '/health',
      '/metrics',
      '/docs',
      '/reference',
      '/openapi.json',
    ],
  });

// =====================
// ORGANIZATION-AWARE MIDDLEWARE
// =====================

/**
 * Require organization membership
 * User must be a member of the active organization or specified organization
 *
 * @param options - Organization authentication options
 */
export const requireOrganization = (options: OrganizationAuthOptions = {}) => {
  return async (c: Context<AppBindings>, next: Next) => {
    const { required = true, permissions, allowedRoles } = options;
    const user = c.get('user');
    const session = c.get('session');

    if (!user || !session) {
      return ApiResponseHelper.unauthorized(c, 'Authentication required');
    }

    // Get active organization from session
    // Note: activeOrganizationId requires the organization plugin to be enabled
    const activeOrgId = (session as any).activeOrganizationId;

    if (!activeOrgId && required) {
      return ApiResponseHelper.forbidden(
        c,
        'No active organization. Please select an organization first.'
      );
    }

    if (activeOrgId) {
      // Get member details with role
      // Note: getActiveMember requires the organization plugin to be enabled
      try {
        const member = await (auth.api as any).getActiveMember({
          headers: c.req.raw.headers,
        });

        if (!member) {
          return ApiResponseHelper.forbidden(c, 'You are not a member of this organization');
        }

        // Store member info in context for later use
        c.set('organizationMember', member as any);
        c.set('activeOrganizationId', activeOrgId);

        // Check role requirements if specified
        if (allowedRoles && allowedRoles.length > 0) {
          const memberRoles = (member.role as string).split(',').map((r: string) => r.trim());
          const hasAllowedRole = allowedRoles.some((role) => memberRoles.includes(role));

          if (!hasAllowedRole) {
            return ApiResponseHelper.forbidden(
              c,
              `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`
            );
          }
        }

        // Check permissions if specified
        // Note: userHasPermission is from the admin plugin
        if (permissions) {
          const hasPermission = await auth.api.userHasPermission({
            headers: c.req.raw.headers,
            body: { permission: permissions },
          });

          if (!hasPermission) {
            return ApiResponseHelper.forbidden(
              c,
              'You do not have the required permissions for this action'
            );
          }
        }
      } catch (error) {
        console.error('Error checking organization membership:', error);
        return ApiResponseHelper.internalError(c, 'Failed to verify organization membership');
      }
    }

    await next();
  };
};

/**
 * Require specific permissions in the active organization
 * User must have the specified permissions in their organization role
 *
 * @param permissions - Object mapping resources to required actions
 */
export const requireOrgPermissions = (permissions: Permission) => {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    const session = c.get('session');

    if (!user || !session) {
      return ApiResponseHelper.unauthorized(c, 'Authentication required');
    }

    if (!(session as any).activeOrganizationId) {
      return ApiResponseHelper.forbidden(c, 'No active organization selected');
    }

    try {
      const hasPermission = await auth.api.userHasPermission({
        headers: c.req.raw.headers,
        body: { permission: permissions },
      });

      if (!hasPermission) {
        return ApiResponseHelper.forbidden(
          c,
          `Insufficient permissions. Required: ${JSON.stringify(permissions)}`
        );
      }

      await next();
    } catch (error) {
      console.error('Error checking permissions:', error);
      return ApiResponseHelper.internalError(c, 'Failed to verify permissions');
    }
  };
};

/**
 * Require specific organization role(s)
 * User must have at least one of the specified roles in the active organization
 *
 * @param roles - Single role or array of roles
 */
export const requireOrgRole = (roles: string | string[]) => {
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    const session = c.get('session');

    if (!user || !session) {
      return ApiResponseHelper.unauthorized(c, 'Authentication required');
    }

    if (!(session as any).activeOrganizationId) {
      return ApiResponseHelper.forbidden(c, 'No active organization selected');
    }

    try {
      const member = await (auth.api as any).getActiveMember({
        headers: c.req.raw.headers,
      });

      if (!member) {
        return ApiResponseHelper.forbidden(c, 'You are not a member of this organization');
      }

      const memberRoles = (member.role as string).split(',').map((r: string) => r.trim());
      const hasRequiredRole = roleArray.some((role) => memberRoles.includes(role));

      if (!hasRequiredRole) {
        return ApiResponseHelper.forbidden(
          c,
          `Insufficient permissions. Required roles: ${roleArray.join(', ')}`
        );
      }

      await next();
    } catch (error) {
      console.error('Error checking organization role:', error);
      return ApiResponseHelper.internalError(c, 'Failed to verify organization role');
    }
  };
};

// =====================
// PLATFORM ADMIN MIDDLEWARE
// Better Auth Admin Plugin
// =====================

/**
 * Check if user has platform admin privileges
 * Uses Better Auth admin plugin
 */
const isUserPlatformAdmin = async (c: Context<AppBindings>): Promise<boolean> => {
  const user = c.get('user');
  if (!user) return false;

  // Check if user has admin role
  const userRoleString = (user.role as string) || '';
  const userRoles = userRoleString.split(',').map((r: string) => r.trim());

  return userRoles.includes('admin') || userRoles.includes('super_admin');
};

/**
 * Require platform admin access
 * User must have platform-level admin role (not organization admin)
 */
export const requirePlatformAdmin = () => {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return ApiResponseHelper.unauthorized(c, 'Authentication required');
    }

    const isAdmin = await isUserPlatformAdmin(c);

    if (!isAdmin) {
      return ApiResponseHelper.forbidden(
        c,
        'Platform admin access required. Contact system administrator.'
      );
    }

    await next();
  };
};

/**
 * Combined middleware: Platform admin OR organization owner
 * Useful for operations that can be performed by either platform admins or business owners
 */
export const requirePlatformAdminOrOrgOwner = () => {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get('user');
    const session = c.get('session');

    if (!user) {
      return ApiResponseHelper.unauthorized(c, 'Authentication required');
    }

    // Check platform admin first
    const isPlatformAdmin = await isUserPlatformAdmin(c);
    if (isPlatformAdmin) {
      await next();
      return;
    }

    // Check organization owner
    if (!(session as any)?.activeOrganizationId) {
      return ApiResponseHelper.forbidden(
        c,
        'No active organization or insufficient platform permissions'
      );
    }

    try {
      const member = await (auth.api as any).getActiveMember({
        headers: c.req.raw.headers,
      });

      if (!member) {
        return ApiResponseHelper.forbidden(c, 'You are not a member of this organization');
      }

      const memberRoles = (member.role as string).split(',').map((r: string) => r.trim());

      if (!memberRoles.includes('owner')) {
        return ApiResponseHelper.forbidden(
          c,
          'Organization owner or platform admin access required'
        );
      }

      await next();
    } catch (error) {
      console.error('Error checking permissions:', error);
      return ApiResponseHelper.internalError(c, 'Failed to verify permissions');
    }
  };
};

// =====================
// ORGANIZATION SETUP MIDDLEWARE
// =====================

/**
 * Require organization database to be set up
 * Checks if the organization's database has been created and initialized
 * Returns helpful error message if setup is pending or failed
 *
 * Use this middleware on routes that need to access organization data
 */
export const requireOrganizationSetup = () => {
  return async (c: Context<AppBindings>, next: Next) => {
    const session = c.get('session');

    if (!(session as any)?.activeOrganizationId) {
      return ApiResponseHelper.forbidden(c, 'No active organization selected');
    }

    try {
      const setupStatus = await checkOrganizationSetup((session as any).activeOrganizationId);

      if (!setupStatus.isSetup) {
        if (setupStatus.status === 'pending') {
          return c.json(
            {
              success: false,
              error: 'Organization setup is still in progress',
              message: 'Your organization database is being set up. Please try again in a few moments.',
              status: 'pending',
            },
            503 // Service Unavailable
          );
        }

        if (setupStatus.status === 'failed') {
          return c.json(
            {
              success: false,
              error: 'Organization setup failed',
              message: 'There was an error setting up your organization. Please contact support.',
              details: setupStatus.error,
              status: 'failed',
            },
            500
          );
        }

        return c.json(
          {
            success: false,
            error: 'Organization database not set up',
            message: 'Your organization database has not been initialized. Please contact support.',
            status: setupStatus.status,
          },
          503
        );
      }

      // Setup is complete, continue
      await next();
    } catch (error) {
      console.error('Error checking organization setup:', error);
      return ApiResponseHelper.internalError(c, 'Failed to verify organization setup');
    }
  };
};
