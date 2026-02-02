# Database Schema Setup Guide

This guide explains how to set up and apply database schemas for the TechStudio API.

## Schema Files

The project includes the following schema files:

1. **`schema.surql`** - Better Auth tables (user, session, account, etc.)
2. **`schema-media.surql`** - Media management tables (media, upload_tracking)

## Quick Setup

### Option 1: Using Surrealist (Recommended)

1. Open [Surrealist](https://surrealist.app) or your local Surrealist instance
2. Connect to your SurrealDB instance using credentials from `.env`:
   - URL: `DATABASE_URL`
   - Username: `DATABASE_USERNAME`
   - Password: `DATABASE_PASSWORD`
   - Namespace: `MAIN_NS` (default: `needxlife`)
   - Database: `MAIN_DB` (default: `core`)
3. Open the Query tab
4. Copy the contents of `schema-media.surql`
5. Paste and execute the queries
6. Verify tables are created by checking the Tables panel

### Option 2: Using SurrealDB CLI

```bash
# Connect to your database
surreal sql --endpoint <DATABASE_URL> --namespace <MAIN_NS> --database <MAIN_DB> --username <DATABASE_USERNAME> --password <DATABASE_PASSWORD>

# Import the schema
surreal import --endpoint <DATABASE_URL> --namespace <MAIN_NS> --database <MAIN_DB> --username <DATABASE_USERNAME> --password <DATABASE_PASSWORD> schema-media.surql
```

### Option 3: Using cURL

```bash
# Apply media schema
curl -X POST \
  -H "Accept: application/json" \
  -H "NS: <MAIN_NS>" \
  -H "DB: <MAIN_DB>" \
  -u "<DATABASE_USERNAME>:<DATABASE_PASSWORD>" \
  --data-binary @schema-media.surql \
  <DATABASE_URL>/sql
```

## Schema Overview

### Media Table

The `media` table stores all uploaded media files with the following key features:

- **File metadata**: name, size, mime_type, dimension
- **Organization**: context (avatar, product, document, general), tags
- **Access control**: access_level (PUBLIC/PRIVATE), owner
- **Image variants**: thumbnail, medium, large, original (for images)
- **Processing status**: tracks async image processing state
- **Soft delete**: deleted_at field for soft deletion
- **Color extraction**: stores dominant colors for images

**Supported Fields:**
- `id` - Record ID (record<media>)
- `name` - File name
- `size` - File size in bytes
- `mime_type` - MIME type (image/jpeg, video/mp4, etc.)
- `context` - Context type (avatar, product, document, general)
- `owner` - Owner ID (user or organization record)
- `access_level` - Access level (PRIVATE or PUBLIC)
- `access_url` - CDN URL for accessing the file
- `caption` - Optional caption
- `tags` - Optional array of tags
- `is_primary` - Whether this is a primary media item
- `dimension` - Image dimensions (e.g., "1200x800")
- `variants` - Image variant URLs (original, thumbnail, medium, large)
- `metadata` - Additional metadata (colors, processing status, etc.)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `deleted_at` - Soft delete timestamp

### Upload Tracking Table

The `upload_tracking` table manages the upload lifecycle:

1. **Pending**: Upload initiated, presigned URL generated
2. **Uploaded**: File uploaded to R2 storage
3. **Confirmed**: Upload confirmed, media record created
4. **Failed**: Upload or processing failed

**Supported Fields:**
- `id` - Record ID (record<upload_tracking>)
- `uploadId` - Unique upload identifier
- `accountId` - Account/user ID initiating upload
- `businessId` - Optional business/organization ID
- `fileName` - Original file name
- `fileSize` - File size in bytes
- `contentType` - File MIME type
- `context` - Upload context
- `key` - Storage key in R2
- `status` - Upload status (pending, uploaded, confirmed, failed)
- `expiresAt` - Expiration timestamp (1 hour default)
- `confirmedAt` - Confirmation timestamp
- `mediaId` - Reference to created media record
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Indexes

The schema includes optimized indexes for common query patterns:

### Media Indexes:
- `idx_media_id` - Unique ID lookup
- `idx_media_owner` - Filter by owner
- `idx_media_context` - Filter by context
- `idx_media_access_level` - Filter by access level
- `idx_media_created_at` - Sort by creation date
- `idx_media_deleted_at` - Filter soft-deleted items

### Upload Tracking Indexes:
- `idx_upload_tracking_id` - Unique ID lookup
- `idx_upload_tracking_uploadId` - Unique upload ID lookup
- `idx_upload_tracking_accountId` - Filter by account
- `idx_upload_tracking_status` - Filter by status
- `idx_upload_tracking_expiresAt` - Cleanup expired uploads
- `idx_upload_tracking_mediaId` - Link to media record

## Verifying Installation

After applying the schema, verify the tables are created:

```sql
-- List all tables in the database
INFO FOR DB;

-- Check media table structure
INFO FOR TABLE media;

-- Check upload_tracking table structure
INFO FOR TABLE upload_tracking;

-- Test queries
SELECT * FROM media LIMIT 1;
SELECT * FROM upload_tracking LIMIT 1;
```

## Environment Configuration

Make sure your `.env` file has the correct database configuration:

```env
# Database configuration
DATABASE_URL=<your_surrealdb_url>
DATABASE_AUTH_TOKEN=<your_auth_token>
DATABASE_USERNAME=<username>
DATABASE_PASSWORD=<password>

# Main namespace and database (used by media service)
MAIN_NS=needxlife
MAIN_DB=core
```

## Sample Data

To test the schema with sample data:

```sql
-- Create a sample media record
CREATE media CONTENT {
  name: "test-image.jpg",
  size: 102400,
  mime_type: "image/jpeg",
  context: "avatar",
  owner: user:test123,
  access_level: "PUBLIC",
  access_url: "https://cdn.example.com/test-image.webp",
  caption: "Test avatar image",
  tags: ["avatar", "test"],
  is_primary: true,
  dimension: "800x600",
  variants: {
    original: "https://cdn.example.com/test-image.webp",
    thumbnail: "https://cdn.example.com/test-image-150x150.webp",
    medium: "https://cdn.example.com/test-image-300x300.webp",
    large: "https://cdn.example.com/test-image-600x600.webp"
  },
  metadata: {
    processingStatus: "completed",
    colors: ["#FF5733", "#33FF57"],
    originalFormat: "jpeg"
  }
};

-- Create a sample upload tracking record
CREATE upload_tracking CONTENT {
  uploadId: "upload_test123",
  accountId: "user123",
  fileName: "test.jpg",
  fileSize: 102400,
  contentType: "image/jpeg",
  context: "avatar",
  key: "user123/avatar/test.jpg",
  status: "pending",
  expiresAt: time::now() + 1h
};
```

## Maintenance

### Cleanup Expired Uploads

The application automatically cleans up expired uploads via a background job, but you can manually run:

```sql
-- Delete expired pending uploads
DELETE FROM upload_tracking
WHERE expiresAt < time::now()
AND status = 'pending';
```

### Purge Soft-Deleted Media

To permanently delete soft-deleted media older than 30 days:

```sql
-- Find soft-deleted media older than 30 days
SELECT * FROM media
WHERE deleted_at IS NOT NULL
AND deleted_at < time::now() - 30d;

-- Permanently delete (use with caution!)
DELETE FROM media
WHERE deleted_at IS NOT NULL
AND deleted_at < time::now() - 30d;
```

## Troubleshooting

### Tables Not Creating

If tables don't create, check:
1. Database connection credentials in `.env`
2. Namespace and database names match `.env` configuration
3. User has proper permissions to create tables
4. SurrealDB version compatibility (requires v2.0+)

### Permission Errors

Ensure your database user has these permissions:

```sql
-- Grant necessary permissions
DEFINE USER <username> ON DATABASE PASSWORD '<password>' ROLES OWNER;
```

## Migration from Other Databases

If migrating from another database:

1. Export existing media data
2. Transform to SurrealDB format
3. Apply schema first
4. Import transformed data
5. Verify data integrity
6. Update application configuration

## Further Reading

- [SurrealDB Documentation](https://surrealdb.com/docs)
- [SurrealDB Schema Guide](https://surrealdb.com/docs/surrealql/statements/define/table)
- [Media API Documentation](./src/routes/media/README.md)
