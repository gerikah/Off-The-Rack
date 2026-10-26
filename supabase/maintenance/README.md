# One-time maintenance

`reset-admin-business-data.sql` clears the admin business records in Off The Rack project `hjujwgfqaxrbcdlcymst`. It is manual SQL, separate from application startup, development seeds, and migrations.

The reset targets product listings and image references, categories, inquiries, subscribers, campaigns, deliveries, batches, unsubscribe tokens, and newsletter rate-limit records. It preserves Supabase Auth users, the admin allowlist, existing schema and policies, image-cleanup tombstones, and Storage files. It does not change contacts stored in external email providers.

Before deleting rows, the script copies the target tables into a private `otr_reset_backup_20261026` schema, removes public/client grants, and enables RLS on the copies. It checks foreign-key dependencies, locks the affected tables against concurrent writes, verifies zero remaining rows, and verifies unchanged account counts. A failure rolls the transaction back. A second run stops because the backup already exists.

Run it only in the intended project's SQL editor as the database owner. The private backup contains the original business records and must remain restricted. This script has not been executed against the live project unless separately confirmed by a successful database result.
