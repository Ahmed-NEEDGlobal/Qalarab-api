import { StringRecordId } from 'surrealdb';
/**
 * Organization Database Setup Service
 * Handles creation and initialization of organization-specific databases
 */

import { dbManager, getMainDB } from '@/lib/surrealdb-multi';

export type OrganizationType = 'retail' | 'restaurant';

export interface SetupResult {
  success: boolean;
  database: string;
  organizationType: OrganizationType;
  error?: string;
  timestamp: string;
}

/**
 * Main function to setup organization database
 * Called from Better Auth organization.onCreate hook
 */
export async function setupOrganizationDatabase(
  organizationId: string,
  organizationType: OrganizationType
): Promise<SetupResult> {
  const timestamp = new Date().toISOString();

  try {
    // Strip the 'organization:' prefix if present
    const cleanOrgId = organizationId.replace(/^organization:/, '');

    console.log(
      `⚙️  Setting up database for organization: ${cleanOrgId} (type: ${organizationType})`
    );

    // Validate organization type
    if (organizationType !== 'retail' && organizationType !== 'restaurant') {
      throw new Error(
        `Invalid organization type: ${organizationType}. Must be 'retail' or 'restaurant'`
      );
    }

    // Create the organization database and apply schema
    await dbManager.createOrganizationDatabase(cleanOrgId, organizationType);
    console.log({
      organizationId,
      b: {
        database: `org_${cleanOrgId}`,
        setupStatus: 'completed',
        setupTimestamp: timestamp,
        organizationType,
      },
    });
    // Update organization metadata in auth database with setup info
    await updateOrganizationMetadata(organizationId, {
      database: `org_${cleanOrgId}`,
      setupStatus: 'completed',
      setupTimestamp: timestamp,
      organizationType,
    });

    console.log(`✓ Successfully set up database for organization: ${cleanOrgId}`);

    return {
      success: true,
      database: `org_${cleanOrgId}`,
      organizationType,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const cleanOrgId = organizationId.replace(/^organization:/, '');
    console.error(`✗ Failed to setup database for organization ${cleanOrgId}:`, error);

    // Try to update organization metadata with error status
    try {
      console.log({
        organizationId,
        a: {
          setupStatus: 'failed',
          setupError: errorMessage,
          setupTimestamp: timestamp,
        },
      });
      await updateOrganizationMetadata(organizationId, {
        setupStatus: 'failed',
        setupError: errorMessage,
        setupTimestamp: timestamp,
      });
    } catch (metadataError) {
      console.error('Failed to update organization metadata:', metadataError);
    }

    return {
      success: false,
      database: `org_${cleanOrgId}`,
      organizationType,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * Update organization record in auth database with setup metadata
 */
async function updateOrganizationMetadata(
  organizationId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const authDb = await getMainDB();
    const id = organizationId.startsWith('organization:')
      ? organizationId
      : `organization:${organizationId}`;
    console.log(id);
    // Get current organization record
    const orgResult = await authDb.query<Array<Array<{ metadata: any }>>>(
      'SELECT metadata FROM $orgId',
      { orgId: new StringRecordId(id) }
    );
    console.log({ orgResult });
    // Extract the result - SurrealDB returns array of results, each result is an array
    const orgRecord = orgResult?.[0]?.[0];

    // Merge existing metadata with new setup info
    const currentMetadata = orgRecord?.metadata || {};

    console.log(currentMetadata);
    const updatedMetadata = {
      ...currentMetadata,
      setup: {
        ...(currentMetadata.setup || {}),
        ...metadata,
      },
    };

    // Update the organization record
    await authDb.query('UPDATE $orgId SET metadata = $metadata', {
      orgId: new StringRecordId(id),
      metadata: JSON.stringify(updatedMetadata),
    });

    console.log(`✓ Updated organization metadata for: ${organizationId}`);
  } catch (error) {
    console.error(`✗ Failed to update organization metadata:`, error);
    throw error;
  }
}

/**
 * Check if an organization database is properly set up
 */
export async function checkOrganizationSetup(organizationId: string): Promise<{
  isSetup: boolean;
  database: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  metadata?: any;
}> {
  try {
    // Strip the 'organization:' prefix if present
    const cleanOrgId = organizationId.replace(/^organization:/, '');

    const authDb = await getMainDB();

    // Make sure we have the full ID for querying
    const fullOrgId = organizationId.includes(':')
      ? organizationId
      : `organization:${organizationId}`;

    // Get organization record from auth database
    const orgResult = await authDb.query<Array<Array<{ id: string; metadata: any }>>>(
      'SELECT id, metadata FROM $orgId',
      { orgId: new StringRecordId(fullOrgId) }
    );

    // Extract the result - SurrealDB returns array of results, each result is an array
    const orgRecords = orgResult?.[0];

    if (!orgRecords || orgRecords.length === 0) {
      return {
        isSetup: false,
        database: `org_${cleanOrgId}`,
        status: 'pending',
        error: 'Organization not found',
      };
    }

    const org = orgRecords[0];
    const setupMetadata = org.metadata?.setup;

    // Check if database actually exists
    const dbExists = await dbManager.checkOrganizationDatabaseExists(cleanOrgId);

    if (!dbExists) {
      return {
        isSetup: false,
        database: `org_${cleanOrgId}`,
        status: 'pending',
        error: 'Database does not exist',
      };
    }

    // If setup metadata exists, use that status
    if (setupMetadata) {
      return {
        isSetup: setupMetadata.setupStatus === 'completed',
        database: setupMetadata.database || `org_${cleanOrgId}`,
        status: setupMetadata.setupStatus || 'pending',
        error: setupMetadata.setupError,
        metadata: setupMetadata,
      };
    }

    // Database exists but no metadata - assume setup is complete (legacy case)
    return {
      isSetup: true,
      database: `org_${cleanOrgId}`,
      status: 'completed',
    };
  } catch (error) {
    const cleanOrgId = organizationId.replace(/^organization:/, '');
    console.error(`Error checking organization setup:`, error);
    return {
      isSetup: false,
      database: `org_${cleanOrgId}`,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get organization type from metadata
 */
export async function getOrganizationType(
  organizationId: string
): Promise<OrganizationType | null> {
  try {
    const authDb = await getMainDB();

    // Make sure we have the full ID for querying
    const fullOrgId = organizationId.includes(':')
      ? organizationId
      : `organization:${organizationId}`;

    const orgResult = await authDb.query<
      Array<Array<{ metadata: any; organizationType?: string }>>
    >('SELECT metadata, organizationType FROM organization WHERE id = $orgId', {
      orgId: new StringRecordId(fullOrgId),
    });

    // Extract the result - SurrealDB returns array of results, each result is an array
    const orgRecords = orgResult?.[0];

    if (!orgRecords || orgRecords.length === 0) {
      return null;
    }

    const org = orgRecords[0];

    // Check in organizationType field first (custom field in schema)
    if (org.organizationType) {
      return org.organizationType as OrganizationType;
    }

    // Fallback to metadata.organizationType
    if (org.metadata?.organizationType) {
      return org.metadata.organizationType as OrganizationType;
    }

    // Fallback to setup metadata
    if (org.metadata?.setup?.organizationType) {
      return org.metadata.setup.organizationType as OrganizationType;
    }

    return null;
  } catch (error) {
    console.error(`Error getting organization type:`, error);
    return null;
  }
}
