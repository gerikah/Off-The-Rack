# Product image operations

The existing `product_images` model is preserved: `product_id`, `image_url`, `storage_path`, `alt_text`, `sort_order`, and `is_primary`. Product details keep their existing schema and save flow.

## Setup

1. Back up the connected database and inspect its applied migrations and `product-images` bucket. Do not run historical `001_storefront.sql`. Apply `002_admin_access.sql` only if it has not been applied, following `ADMIN_SETUP.md`.
2. Apply the new idempotent `supabase/migrations/003_product_images.sql` to a development/staging project first, then the existing production project after verification. It adds named Storage policies, image mutation RPCs, and a protected cleanup queue with reference guards. It does not rewrite existing products or images.
3. The migration creates the `product-images` bucket if absent. New uploads are restricted to image MIME types with a 5 MB bucket limit. It deliberately refuses to change an existing nonempty private bucket into a public bucket; review its contents first in Supabase Storage. Public catalog images must be appropriate for anyone with their URL to view, including photos of archived or sold products. A public bucket bypasses read RLS for known public URLs; it is not a place for private artwork or customer files.
4. Existing server environment values `NEXT_PUBLIC_SUPABASE_URL` and the publishable key are sufficient. The upload uses the administrator's verified Supabase session and RLS; no service-role key is needed. Configure the Vercel production variables and deploy the repository using the Next.js preset.
5. Keep `sharp` as a production dependency. `next.config.ts` allows a 4 MB Server Action request body; the client prepares files below 3 MB to leave multipart overhead below Vercel's request limit.

## Administrator workflow

- Create the product with **Save product**. You are taken directly to its edit page to add photos. This avoids creating orphan temporary uploads before a product exists. If you leave at this stage, the product is saved with the existing storefront fallback image.
- Select **Add an image**, review the preview, supply a short description of what the photo shows, and select **Upload image**. Image changes save independently of the product detail form; the interface says when they are preparing, uploading, or saved. Up to 12 photos can be added.
- The first image becomes the cover. **Make cover** changes the cover without changing the remaining gallery order. Edit alt text with **Save image**.
- **Replace image** prepares a replacement preview. **Cancel selection** preserves the current saved image. **Save image** uploads the replacement to a new unique path; existing CDN URLs are never overwritten.
- **Remove image** opens a keyboard-accessible confirmation dialog. Removing the cover promotes the first remaining image. Deleting a product preserves inquiry history through the existing guarded deletion RPC.
- **Retry unused image cleanup** on Products processes up to 20 queued unreferenced files per click. It remains available when the catalog is empty. If the Storage API is temporarily unavailable, the image/product mutation remains saved and the cleanup can be retried.

## Validation and authorization

The browser accepts JPEG, PNG, WebP, and AVIF originals up to 5 MB and checks their file signatures. It decodes and prepares a still WebP preview at a maximum 2400-pixel edge, bounded to 3 MB. Very large images over 40 megapixels are rejected. Unsupported browser decoding gives an actionable export-to-JPEG/PNG/WebP error.

The server independently verifies the authenticated user and admin membership, validates the product/image IDs and alt text with Zod, checks file size and MIME against magic bytes, decodes the image using `sharp` with a 40-megapixel limit, and re-encodes it. Re-encoding strips metadata including EXIF/GPS and ignores original filenames. The server only generates `products/{product-uuid}/{random-uuid}.webp` paths. Malformed or disguised files are rejected. The server's own prepared-file limit is 3 MB; the 5 MB original limit is enforced before browser compression.

Every mutation runs with the admin JWT and database authorization. Gallery mutations lock the parent product for consistent cover changes and the 12-image limit. Restrictive Storage policies preserve other buckets while preventing old permissive policies from granting unauthorized product bucket writes. Updates/overwrites are disabled; replacements use a new object. Public users cannot list the bucket through its authenticated API or upload/update/delete objects. Authorized admins are trusted content editors; a deliberately modified admin client can use its granted Storage insert permission directly, so only this application's upload path guarantees decoder processing.

## Safe cleanup

Replacement and removal triggers queue unreferenced generated paths in the same database transaction. A path-specific advisory lock and permanent cleanup tombstone prevent a concurrent product edit from attaching a file after it has been claimed for deletion. Both explicit storage paths and URL-only references are checked, including percent-encoded managed paths. Shared references keep their file. Storage deletion RLS also requires a cleanup claim and no remaining reference.

The app removes file bytes through the Supabase Storage API, never by deleting `storage.objects` rows in SQL. Failed removals remain queued. Keep completed queue records: their tombstones prevent stale references from attaching deleted objects. The queue holds object paths and timestamps, with no customer information, and is readable only by admins.

Only paths generated by this uploader are automatically removed. Historical local assets, external URLs, and unrecognized legacy object paths are preserved. Review and clean legacy orphans manually after checking every product reference. A process crash between upload and database attachment can leave a newly uploaded object without a queue entry; periodically compare older unreferenced objects with `product_images` in a reviewed maintenance task. Do not blindly empty the bucket or delete storage metadata with SQL.

## Verification and limitations

`npm run test -- tests/image-upload.spec.ts tests/admin-images.spec.ts tests/admin.spec.ts` checks signature/MIME and size validation, real decoder failures, JPEG/PNG/WebP/AVIF conversion, resizing and metadata removal, plus the admin preview/upload/replace/remove/alt/shared-reference flow and membership recheck against the local backend fixture. Existing admin CRUD/status/category/inquiry tests remain in place.

The fixture proves application behavior, not live Storage RLS or PostgreSQL concurrency. Before production rollout, test migration replay, anonymous and non-admin denied writes, admin upload/replace/remove, shared image retention, concurrent attach-versus-cleanup, a failed Storage deletion followed by retry, and product deletion with an inquiry in an isolated Supabase project. No live bucket or product mutation was performed by the repository implementation.

References: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [public/private bucket behavior](https://supabase.com/docs/guides/storage/buckets/fundamentals), [delete objects through the Storage API](https://supabase.com/docs/guides/storage/management/delete-objects), [sharp decoder limits](https://sharp.pixelplumbing.com/api-constructor/).
