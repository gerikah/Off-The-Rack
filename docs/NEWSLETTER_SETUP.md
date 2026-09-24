# Newsletter setup and operation

**Legacy Resend campaign guide.** Loops is now the primary contact/email platform: follow [Loops setup](LOOPS_SETUP.md) for signup, reactivation, welcome workflows and inquiry confirmations. The existing admin campaign tools below remain available, but keep `NEWSLETTER_SEND_ENABLED=false` when using Loops; their unsubscribe states are not automatically synchronized. Migration 006 supersedes the pre-006 signup behavior below: fresh consent can reactivate an inactive subscriber, and existing active addresses receive a distinct already-subscribed response.

The repository implements delivery; the provider account, sender verification, secrets, deployment, and real inbox checks still require the project owner. No real email was sent during implementation. Subscriber campaigns are disabled unless the server environment contains exactly `NEWSLETTER_SEND_ENABLED=true`.

## Architecture and preserved data

This project already uses Next.js App Router. Its Node.js route `/api/admin/newsletter` is the server-side delivery function deployed with Vercel. **There is no Supabase Edge Function to deploy.** Adding a second runtime would duplicate the existing authenticated server. Supabase remains the database and authentication provider; the application uses the publishable key plus the signed-in administrator's session, never a service-role key.

The server verifies the user with Supabase Auth and checks `otr_is_admin()` on every request. Migration 004's security-definer RPC independently checks membership. Internal campaign, delivery, batch, token-hash, and rate-limit tables have RLS enabled and no browser table grants. Only checked RPCs can access them. The UI receives campaign content, status, and counts; no subscriber list is returned. A test recipient is always the verified email on the signed-in administrator's account. Clients cannot choose a test destination.

Migration `004_newsletter.sql` adds consent evidence to existing `newsletter_subscribers`, retaining existing rows, timestamps, and active/opt-out state. Old rows start as `legacy_unverified`, excluded from campaigns. After reviewing the original voluntary signup evidence for every active legacy record, an administrator can explicitly confirm the displayed count. This records verification time and administrator ID without inventing an original consent date. If only some records have evidence, leave the bulk verification unconfirmed and have a database operator verify only the evidenced rows. Never enroll purchased addresses or infer consent from an inquiry.

New signups require a checkbox, honeypot and form timing validation. The database normalizes email, protects consent/status fields, rejects case-insensitive duplicates, and enforces durable signup quotas even for direct clients. Existing duplicate rows are preserved; each campaign selects at most one active, consented row per normalized address. An already-present address receives the same public response, preventing enumeration. An anonymous signup cannot reactivate an opt-out. Re-enrollment currently requires separately recorded fresh consent and deliberate database administration; there is no automated resubscribe or double-opt-in workflow.

## 1. Prepare the existing Supabase project

1. Back up the current database and review its schema and migration history. Do not replay `001_storefront.sql`: it is historical and differs from the connected storefront schema.
2. Apply missing additive migrations in order: `002_admin_access.sql`, `003_product_images.sql`, `004_newsletter.sql`, then `005_submission_security.sql`. Apply through the existing project migration process or Supabase SQL Editor after reviewing each file. Do not recreate existing application tables.
3. Confirm the administrator's Supabase Auth user belongs to `public.admin_users`, and their Auth email is confirmed. Sign in at `/admin/login` and open `/admin/newsletter`. The eligible/legacy counts should appear. A setup message means the migration or membership checks failed.
4. Verify ordinary authenticated users cannot call `otr_newsletter_admin`, and anonymous users cannot read subscriber or campaign tables. Run `npm run test:db` locally for isolated PostgreSQL regression checks; these do not verify your deployed project's policies.

## 2. Create and verify the email provider

Create a Resend account under the studio's control. Add a sending domain or subdomain you control, such as `mail.example.com`, and copy the exact DNS records Resend provides into your DNS host. Wait until Resend reports verification complete; confirm the sender address belongs to that verified domain. Preserve existing mail-related DNS records when adding the provider's records. See [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).

Create a Resend API key with the smallest available sending permission, restricted to that domain where supported. The application only sends emails; it does not manage Resend contacts or domains. Copy the key directly into the server secret store. See [Resend API key management](https://resend.com/docs/dashboard/api-keys/introduction). Check the account's current sending quota before planning the first campaign.

## 3. Add server configuration

In Vercel, open the existing project, then Settings > Environment Variables. Add the following variables for the intended deployment environment. Keep production subscriber campaigns disabled during setup; use a separate staging Supabase project with only your own test addresses for the full campaign/unsubscribe exercise.

| Variable                               | Placeholder / purpose                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                       | Provider API key; server secret only                                                            |
| `NEWSLETTER_FROM`                      | `Off The Rack <drops@mail.example.com>`, using the verified domain                              |
| `NEWSLETTER_REPLY_TO`                  | Optional monitored mailbox, e.g. `studio@example.com`                                           |
| `NEWSLETTER_POSTAL_ADDRESS`            | Studio's real mailing address, included in every email footer                                   |
| `NEWSLETTER_UNSUBSCRIBE_SECRET`        | Random secret containing at least 32 random bytes; base64url encoding is at least 43 characters |
| `NEWSLETTER_SEND_ENABLED`              | `false` initially; exact `true` enables subscriber campaigns                                    |
| `NEXT_PUBLIC_SITE_URL`                 | Canonical HTTPS storefront origin, e.g. `https://offtherack.vercel.app`                         |
| `NEXT_PUBLIC_SUPABASE_URL`             | Existing project URL                                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing public/publishable key; current legacy anon-key fallback remains supported             |

Generate the unsubscribe secret with a trusted password manager or a local command such as `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Paste it only into the secret store, then clear the terminal output. Do not paste it into an issue, commit, screenshot, or chat. Preserve it securely; changing it while a campaign is running changes the exact batch payload and pauses delivery. Previously issued token hashes remain valid after rotation.

For local development, use ignored `.env.local`. Do not prefix provider or unsubscribe secrets with `NEXT_PUBLIC_`. Do not add a Supabase service-role key. Preview deployments should use an isolated test database; leave their campaign flag false unless intentionally testing a list containing only addresses you control.

## 4. Deploy the server function

Deploy the existing Next.js application to the existing Vercel project using its normal Git deployment or approved Vercel workflow. The newsletter and unsubscribe route handlers deploy with the application; no separate Edge Function command or Supabase secrets are needed. Redeploy after changing environment configuration. The delivery route declares a 60-second duration and uses a 20-second provider-request timeout; confirm your Vercel plan supports the configured function duration.

Confirm `/admin/newsletter` is reachable after login, anonymous access redirects, and public signup still works. An incomplete provider configuration leaves drafts available and sending controls disabled. With valid provider settings and the campaign flag false, only the self-test button is enabled.

## 5. Send a self-test

1. Sign in with a verified administrator email you control.
2. Save a draft with a subject and plain-text content. The preview escapes markup. Saved content is immutable so retries cannot silently send a changed message; create a new draft for revisions.
3. Click **Send test to my admin email**. A test goes only to that account and uses a `[TEST]` subject. The test button is rate-limited to one request per minute for the project.
4. Confirm inbox receipt, subject, typography, paragraph breaks, studio address, and optional reply-to. Check the Resend delivery log; an API acceptance message alone does not prove inbox delivery. Test emails intentionally have an explanatory footer instead of a subscriber unsubscribe token.

## 6. Verify campaign delivery and unsubscribe in staging

Use a separate staging database containing only voluntary test subscriptions to addresses you control. Set its canonical HTTPS site URL to the staging origin. Set `NEWSLETTER_SEND_ENABLED=true` only in that staging environment and redeploy.

Save a draft, send its self-test, select **Review and send**, read the exact recipient count, check the explicit confirmation, and confirm. The server rechecks the count and snapshots the audience atomically. Each action sends up to 25 individual messages; each message has exactly one recipient. Use **Send next batch / resume** until complete. The application intentionally does not run an unbounded loop or a background cron.

Open the unsubscribe link from your received campaign email. It loads `/unsubscribe#TOKEN`; the fragment is removed from browser history after loading. Click the confirmation button, then check the subscriber's `is_active=false` and `unsubscribed_at` in Supabase. Open the same link again to verify the operation remains safe. A GET to the API never unsubscribes, protecting against ordinary link previews and scanners. A supporting mail client's one-click action uses the separate RFC 8058 POST endpoint. Check that this also opts out your staging subscriber. A subsequent staging campaign must exclude that address.

The server stores SHA-256 token hashes. Tokens are HMAC-derived from subscriber IDs with the server secret and cannot be guessed from the IDs. Invalid/unknown token responses do not reveal subscriber addresses. Unsubscribe disables all historical rows matching the normalized address without deleting them. Queued recipients are rechecked before each new batch and immediately before provider submission; a provider request already in flight cannot be recalled.

## 7. Enable production campaigns deliberately

After staging verification, recheck production domain verification, inbox delivery, unsubscribe reachability, account quota, eligible counts, and legacy consent evidence. Keep production `NEXT_PUBLIC_SITE_URL` at the canonical origin. Set the **production** `NEWSLETTER_SEND_ENABLED=true` and redeploy. Send a self-test, review the immutable draft, then confirm the actual production recipient count. Finish all batches promptly. Set the flag back to false and redeploy to stop further campaign requests when necessary; already accepted emails cannot be recalled.

## Retries, limits, and recovery

Resend's batch endpoint supports up to 100 messages; this application uses 25 to keep runtime and payload bounded. Requests use strict batch validation and individual recipient envelopes. The API adapter is isolated in `src/lib/newsletter/server.ts`; replacing a provider requires preserving batch/idempotency semantics. See [Resend batch API](https://resend.com/docs/api-reference/emails/send-batch-emails).

Campaign/batch IDs form a stable idempotency key. A payload fingerprint freezes message content, address ordering, sender configuration, and unsubscribe links on first preparation. Resend retains idempotency keys for 24 hours; the application permits uncertain retries for less than 23 hours from batch creation, leaving a safety margin. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

| Situation                                                                                 | Required action                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Count changed                                                                             | Refresh counts, review the new audience size, and confirm again.                                                                                    |
| Another batch processing                                                                  | Wait at least 60 seconds, refresh, and resume the same campaign.                                                                                    |
| Provider timeout, 429, or 5xx                                                             | Inspect provider configuration/logs. Resume the same campaign within 23 hours, after the 60-second lease; do not create a replacement.              |
| Sender, body, secret, recipient address, or template changed during an uncertain batch    | The fingerprint blocks a changed retry. Restore the exact original configuration only if still within the retry window and provider state is known. |
| Campaign paused, retry window elapsed, or a recipient opted out during an uncertain batch | Stop. Inspect the specific campaign/batch in Supabase and provider logs. Do not reset batch timestamps or create a replacement campaign.            |

For a paused batch, a database operator must reconcile each delivery against the provider before changing state: record accepted provider IDs as sent, explicitly exclude confirmed unsent/opted-out rows, and leave any unknown outcome paused. Update counts and batch/campaign state in one reviewed transaction. There is intentionally no automatic retry or UI override after the provider's safe idempotency window. If acceptance cannot be established, retain the pause; claiming an uncertain email was unsent could cause duplicates. Do not directly edit subscriber emails, sender settings, secrets, rendering code, or campaign payload while sends remain in progress.

Database rate limits serialize provider actions at least two seconds apart across test and campaign requests, with a separate one-minute test limit, 20 draft creations per day, and signup limits of 30 per minute / 1,000 per day. The public API adds a small per-instance IP brake; this is not described as distributed protection. Large lists that need unattended delivery should move the same state machine into a durable queue/worker with provider-limit monitoring.

Campaign `sent` means every queued row was accepted by the provider or excluded. The UI reports **accepted by provider**, not delivered to inbox. Delivery/open/click analytics, bounce/complaint webhooks, automatic suppression synchronization, and scheduling are not implemented. Review provider suppressions and delivery failures before subsequent campaigns. No extra subscriber export or duplicate email list is stored in the app.

## Logging and maintenance

Application logs contain safe error categories, HTTP/database codes, campaign IDs, and counts, never API keys, request bodies, unsubscribe tokens, or recipient lists. The RFC 8058 one-click URL necessarily contains a bearer token in its query string: configure hosting, proxy, analytics, and provider log retention/redaction accordingly, and do not add request-URL logging to this endpoint. Its database grants allow only the hash-based unsubscribe RPC.

Keep delivery disabled if configuration is uncertain. Back up campaign/token tables along with subscriber consent and opt-out records. Never delete opt-out rows to allow a duplicate signup. Rotate an exposed provider key at Resend and redeploy with its replacement; never assume removing it from a file is sufficient. Pause active campaigns before intentional unsubscribe-secret rotation. Verify rate limits and provider API behavior against current documentation during upgrades.

Run `npm run typecheck`, `npm run lint`, `npm run test:db`, and `npx playwright test tests/newsletter.spec.ts` before deploying changes. The tests use local doubles and isolated PostgreSQL semantics and explicitly disable real provider access. They cannot certify your production DNS, secrets, account permissions, inbox delivery, live RLS, or mail-client one-click support; complete the manual checks above.
