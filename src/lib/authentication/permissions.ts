import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, ownerAc } from 'better-auth/plugins/organization/access';
import { defaultStatements as adminDefaultStatements, adminAc as platformAdminAc, userAc as platformUserAc } from 'better-auth/plugins/admin/access';

/**
 * Define all resources and their actions for the platform
 * This covers business/organization operations, products, spaces, etc.
 */
const statement = {
  // Platform-level admin permissions (from Better Auth Admin Plugin)
  ...adminDefaultStatements, // user, session management

  // Organization management (extending Better Auth defaults)
  organization: ['read', 'update', 'delete'],
  member: ['read', 'create', 'update', 'delete'],
  invitation: ['read', 'create', 'cancel'],

  // Business/Organization specific resources
  product: ['create', 'read', 'update', 'delete', 'publish', 'unpublish'],
  category: ['create', 'read', 'update', 'delete', 'assign', 'unassign'],
  space: ['create', 'read', 'update', 'delete', 'archive', 'restore'],
  media: ['create', 'read', 'update', 'delete', 'attach', 'detach'],
  sku: ['create', 'read', 'update', 'delete'],
  file: ['create', 'read', 'update', 'delete', 'download'],

  // Business settings and configuration
  business: ['read', 'update', 'delete', 'configure'],
  analytics: ['read', 'export'],

  // Access control (for dynamic role management)
  ac: ['create', 'read', 'update', 'delete'],
} as const;

export const ac = createAccessControl(statement);

// =====================
// PLATFORM-LEVEL ROLES (Admin Plugin)
// These are user-level roles, not organization-level
// =====================

/**
 * PLATFORM ADMIN ROLE
 * Can manage all users and sessions on the platform
 * Has access to admin APIs for user management
 */
export const platformAdmin = ac.newRole({
  // Admin plugin permissions
  ...platformAdminAc.statements,

  // No organization-specific permissions (platform admins manage the platform, not individual businesses)
  // They need to be added to organizations separately to manage them
});

/**
 * PLATFORM USER ROLE
 * Regular user with no admin privileges
 * Can only manage their own account
 */
export const platformUser = ac.newRole({
  // User plugin permissions (minimal/none for admin operations)
  ...platformUserAc.statements,
});

/**
 * OWNER ROLE (Organization-level)
 * Full control over the business/organization
 * Can manage all resources, members, and settings
 */
export const owner = ac.newRole({
  // Organization management (from Better Auth)
  ...ownerAc.statements,

  // Platform admin permissions (none for org owners - they're not platform admins)
  user: [],
  session: [],

  // Business resources - full access
  product: ['create', 'read', 'update', 'delete', 'publish', 'unpublish'],
  category: ['create', 'read', 'update', 'delete', 'assign', 'unassign'],
  space: ['create', 'read', 'update', 'delete', 'archive', 'restore'],
  media: ['create', 'read', 'update', 'delete', 'attach', 'detach'],
  sku: ['create', 'read', 'update', 'delete'],
  file: ['create', 'read', 'update', 'delete', 'download'],
  business: ['read', 'update', 'delete', 'configure'],
  analytics: ['read', 'export'],
  ac: ['create', 'read', 'update', 'delete'],
});

/**
 * ADMIN ROLE (Organization-level)
 * Can manage most business operations except deleting the business
 * Cannot delete the organization or change ownership
 */
export const admin = ac.newRole({
  // Organization management (from Better Auth)
  ...adminAc.statements,

  // Platform admin permissions (none for org admins)
  user: [],
  session: [],

  // Business resources - full access except business deletion
  product: ['create', 'read', 'update', 'delete', 'publish', 'unpublish'],
  category: ['create', 'read', 'update', 'delete', 'assign', 'unassign'],
  space: ['create', 'read', 'update', 'delete', 'archive', 'restore'],
  media: ['create', 'read', 'update', 'delete', 'attach', 'detach'],
  sku: ['create', 'read', 'update', 'delete'],
  file: ['create', 'read', 'update', 'delete', 'download'],
  business: ['read', 'update', 'configure'],
  analytics: ['read', 'export'],
  ac: ['read'],
});

/**
 * MANAGER ROLE (Organization-level)
 * Can manage products, categories, and content
 * Limited settings access
 */
export const manager = ac.newRole({
  // Organization - read only
  organization: ['read'],
  member: ['read'],
  invitation: [],

  // Platform admin permissions (none)
  user: [],
  session: [],

  // Business resources - manage products and content
  product: ['create', 'read', 'update', 'delete', 'publish', 'unpublish'],
  category: ['create', 'read', 'update', 'delete', 'assign', 'unassign'],
  space: ['create', 'read', 'update', 'delete', 'archive', 'restore'],
  media: ['create', 'read', 'update', 'delete', 'attach', 'detach'],
  sku: ['create', 'read', 'update', 'delete'],
  file: ['create', 'read', 'update', 'delete', 'download'],
  business: ['read'],
  analytics: ['read'],
  ac: [],
});

/**
 * EDITOR ROLE (Organization-level)
 * Can create and edit content but cannot delete
 * No access to business settings
 */
export const editor = ac.newRole({
  // Organization - read only
  organization: ['read'],
  member: ['read'],
  invitation: [],

  // Platform admin permissions (none)
  user: [],
  session: [],

  // Business resources - create and edit only
  product: ['create', 'read', 'update', 'publish', 'unpublish'],
  category: ['read', 'assign', 'unassign'],
  space: ['read', 'update'],
  media: ['create', 'read', 'attach', 'detach'],
  sku: ['create', 'read', 'update'],
  file: ['create', 'read', 'update', 'download'],
  business: ['read'],
  analytics: ['read'],
  ac: [],
});

/**
 * VIEWER ROLE (Organization-level Member)
 * Read-only access to business resources
 */
export const member = ac.newRole({
  // Organization - read only
  organization: ['read'],
  member: ['read'],
  invitation: [],

  // Platform admin permissions (none)
  user: [],
  session: [],

  // Business resources - read only
  product: ['read'],
  category: ['read'],
  space: ['read'],
  media: ['read'],
  sku: ['read'],
  file: ['read', 'download'],
  business: ['read'],
  analytics: ['read'],
  ac: [],
});

/**
 * Export organization roles for use in organization plugin
 */
export const organizationRoles = {
  owner,
  admin,
  manager,
  editor,
  member,
};

/**
 * Export platform roles for use in admin plugin
 */
export const platformRoles = {
  admin: platformAdmin,
  user: platformUser,
};

/**
 * Export all roles (backward compatibility)
 */
export const roles = {
  ...organizationRoles,
  platformAdmin,
  platformUser,
};
