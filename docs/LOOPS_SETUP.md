# Loops email setup

Loops is the primary platform for new subscriber contacts, the drop-list welcome, inquiry confirmations, and future manually sent marketing campaigns. Supabase remains the website/admin record of subscriptions and inquiries. No account, real key, live migration, or real email delivery was configured or tested by the automated suite.

## 1. Prepare Supabase

Back up and inspect your existing project, then test in staging. After the existing migrations 002–005, apply **`supabase/migrations/006_loops_subscriptions.sql`**. Do not replay historical 001 or recreate `newsletter_subscribers`.

006 adds an email UNIQUE constraint if missing and a unique normalized-email index. It stops without changing data if existing case/whitespace variants conflict. Review such records with their consent/delivery history before retrying; the migration never deletes or merges them silently. The existing test schema already has an email UNIQUE constraint; the production schema must still be inspected by the owner.

The narrow `otr_subscribe_newsletter(email_value, consent_value)` RPC normalizes email, requires consent, serializes concurrent requests using the same lock as the existing insert guard, and returns only a subscription status plus whether provider work should run. No service-role key is needed. Existing table RLS and public column permissions remain unchanged; anonymous clients cannot list or directly update subscribers. The new attempts table is private under RLS and records hashed addresses only for bounded rate limiting.

New addresses become active. Existing active addresses stay active. An explicit new consent submission reactivates an inactive address, records fresh consent, and clears its unsubscribe timestamp without changing its ID or creation time. As requested, the UI distinguishes an already-active address; this reveals membership to someone submitting that address. This is single opt-in, not email ownership verification. Inquiries never imply marketing consent.

Limits: immediate repeats of an active address return `already_subscribed` without any Loops call; otherwise at most one provider-sync attempt per address per minute, ten per day, thirty globally per minute, and one thousand per day. The RPC retains attempt rows for one day and prunes them on subsequent accepted calls. The existing public API origin, honeypot, timing, body-size and per-instance limits remain.

## 2. Configure Loops and environment variables

Create a Loops account for the studio. Verify the sending domain and sender/reply-to addresses in Loops using the DNS values it supplies. Under **Settings → API**, create an API key and place it directly into ignored `.env.local`; do not paste it into source, Git, screenshots, or chat. Later add the same variable names to **Vercel → Project → Settings → Environment Variables**, scoped to the intended environment, and redeploy.

| Variable                                                            | Purpose                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `LOOPS_API_KEY`                                                     | Required server-only Loops credential.                                                      |
| `LOOPS_WELCOME_EVENT_NAME`                                          | Name matching the active welcome workflow trigger; recommended `otr_newsletter_subscribed`. |
| `LOOPS_NEWSLETTER_MAILING_LIST_ID`                                  | Optional dedicated drop-list ID; the contact is subscribed to this list when supplied.      |
| `LOOPS_INQUIRY_TRANSACTIONAL_ID`                                    | Published customer inquiry-confirmation template ID.                                        |
| `LOOPS_ADMIN_NOTIFICATION_TRANSACTIONAL_ID`                         | Optional published internal-notification template ID.                                       |
| `ADMIN_NOTIFICATION_EMAIL`                                          | Optional internal recipient; both internal-notification values must be set.                 |
| `NEXT_PUBLIC_SITE_URL`                                              | Canonical HTTPS storefront origin used for email links.                                     |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing Supabase public connection settings.                                               |

Only the existing public connection/origin variables use `NEXT_PUBLIC_`. The Loops service imports `server-only` and uses a fixed HTTPS provider origin, a four-second request timeout, and no raw-error logging. The admin notification address is not returned to the browser. Missing provider configuration never prevents an otherwise valid Supabase save.

## 3. Design and activate the welcome workflow

The requested welcome promotes the collection, so it uses a **marketing workflow**, not a transactional template. Loops classifies welcome/onboarding emails as marketing and honors marketing unsubscribe/suppression preferences on workflows. Consequently this project uses `LOOPS_WELCOME_EVENT_NAME` instead of `LOOPS_WELCOME_TRANSACTIONAL_ID`.

Create a workflow triggered by the exact event name above. Create its `shopUrl` event property as a string and use it for the collection CTA. Configure the workflow's entry/re-entry rules deliberately; a one-time welcome is the safest default. Activate the workflow before testing. Avoid also enabling a second “Contact added” welcome, which could duplicate the event-triggered email. New subscriptions and explicit inactive-to-active transitions trigger the event; existing active subscribers do not get another welcome from the app.

Design in the Loops editor: black and off-white, restrained silver dividers, the existing logo, one strong product photograph, bold headings, and a clear CTA. Use email-safe fonts/fallbacks and simple responsive blocks. Give images alt text. Avoid animation, JavaScript, parallax, and hover-dependent content. Include Loops' marketing unsubscribe control, sender/postal details, and the studio's public social links from `src/lib/brand.ts`.

Suggested content:

> OFF THE RACK
>
> YOU'RE ON THE LIST.
>
> New pieces. Custom slots. Limited drops.
>
> You'll be the first to know what's coming off the rack.
>
> SHOP THE COLLECTION
>
> WEARABLE ART. NO REPEATS.

The code sends `PUT /contacts/update` using normalized email, `subscribed: true`, the source “Off The Rack drop list,” and the optional list membership. This provider endpoint upserts the contact. After that succeeds it sends the welcome event with `shopUrl`. A provider acceptance response does not prove that a workflow was activated or that a message reached an inbox.

## 4. Publish inquiry confirmation templates

Create a transactional template in Loops, publish it, and copy its ID into `LOOPS_INQUIRY_TRANSACTIONAL_ID`. Templates remain editable in Loops; publish revisions to use them for future messages. These emails acknowledge a customer request and should contain no marketing offers.

Supported case-sensitive data variables:

| Variable         | Value                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| `customerName`   | Submitted customer name.                                                              |
| `inquiryType`    | `product`, `custom`, or `general`.                                                    |
| `requestHeading` | `CUSTOM PIECE REQUEST RECEIVED` for custom requests; otherwise `WE GOT YOUR INQUIRY.` |
| `productName`    | Name from the validated database product; empty for other inquiry types.              |
| `productPrice`   | Formatted PHP price from the product at submission time; empty otherwise.             |
| `productUrl`     | Canonical product link; empty otherwise.                                              |
| `shopUrl`        | Canonical shop link.                                                                  |

Create these data variables in the editor. Display the product block conditionally when `productName` is present; non-product values are empty strings. Use text variables, not raw HTML, and keep customer-controlled values out of email headers. Product names/prices/links come from the server's available-product lookup, never extra browser fields. No internal inquiry status is sent.

Suggested body: **OFF THE RACK — WE GOT YOUR INQUIRY.** “Thanks for reaching out. We'll review your request and get back to you with availability, payment, or customization details.” Add the product summary for product inquiries and the custom heading for custom requests. Match the welcome's restrained brand styling, logo and footer. Loops transactional emails do not automatically contain a marketing unsubscribe link; do not repurpose this template for promotions.

For optional staff notifications, publish a separate template and set both optional variables. It receives the same variables plus `customerEmail` and `message`. Keep the recipient server-only and limited to the studio. Customer and staff sends use `addToAudience: false`; neither subscribes an inquiry customer to marketing.

## 5. Failures, retries, and unsubscribe ownership

All sends happen after a successful Supabase write. Invalid input or failed database writes cause no provider calls. A contact-sync or welcome-event failure returns a safe partial-success status: the subscription remains saved. An inquiry-email failure still returns HTTP 201 with the inquiry saved; the UI tells the customer not to submit again. Logs contain only fixed operation names and HTTP/category codes, never provider response bodies, keys, tokens, or customer payloads.

Calls are awaited within the route, not detached background promises. Each event/transactional request gets an idempotency key. There is no automatic retry worker and no exactly-once delivery claim: an interrupted process after saving can miss a notification, and a timed-out provider request might already have been accepted. A 409 is treated as uncertain, not silently called delivered. Check Loops activity before manually resending. Repeating a newsletter submission after the cooldown can repair contact sync, but an already-active subscriber does not automatically receive another welcome. This avoids repeated signups being used to resend email indefinitely.

Loops owns its campaign/workflow opt-out and suppression state. Supabase owns the website's local record. **Automatic Loops → Supabase unsubscribe webhooks are not implemented in this change.** A future authenticated/verified webhook can set `is_active=false` and `unsubscribed_at` without deleting a row. The server contact helper already accepts `subscribed=false` for a future outbound reconciliation process; it is not exposed as an anonymous update endpoint. Never replay old `subscribed=true` snapshots over a newer provider opt-out: the current true-setting call is only made for a fresh explicit form consent.

The existing Resend admin campaigns and token-unsubscribe route are preserved for compatibility. They do not synchronize Loops opt-outs. Keep `NEWSLETTER_SEND_ENABLED=false` and use Loops for new marketing; do not send from both platforms before reconciling preferences. Existing Resend setup is documented separately in [the legacy campaign guide](NEWSLETTER_SETUP.md).

## 6. Test locally and prepare Vercel

Automated checks: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:db`, and `npm.cmd run test:production`. The browser runner forces a synthetic Loops key/template configuration and preloads a test-only transport that redirects every Loops request to a local fixture. It refuses non-fixture credentials. No automated test uses live subscriber data or sends real mail. The production suite checks browser bundles for the synthetic key, private variable names and provider endpoint. Rebuild with `npm.cmd run build` afterward to restore normal public configuration.

For one deliberate real test, use a staging database and an inbox you own. Apply 006, set the server variables in ignored `.env.local`, activate the welcome workflow, publish the inquiry template, and run `npm.cmd run dev`. Submit one new subscription with consent. Check one normalized active row in Supabase, one contact in Loops, the workflow event, provider activity, and actual inbox receipt. Resubmit after one minute: one database row and no second welcome. Test a staged inactive subscriber with fresh consent and confirm reactivation. Test the email's unsubscribe control in Loops, noting that Supabase will not yet update automatically.

Submit one general/custom inquiry using your own inbox, then one available staging-product inquiry. Confirm each row persists, the customer receives the correct template, the product summary is correct, and no marketing contact was created for an inquiry-only address. Check the optional internal inbox if configured. Review spam folders and provider suppression/delivery logs; API acceptance alone is not delivery verification.

Once staging passes, apply the reviewed migration to the intended production database, configure the Loops variables plus the existing public variables in Vercel, and deploy through the existing project. Keep legacy campaign sends disabled. No product creation or edit automatically sends a campaign. Design and send new drops, arrivals, custom slots, collection releases and archive highlights intentionally from Loops.

## Provider references

- [Contact upsert](https://loops.so/docs/api-reference/update-contact)
- [Workflow events](https://loops.so/docs/api-reference/send-event)
- [Welcome email category and workflow setup](https://loops.so/resources/send-welcome-email-after-signup)
- [Transactional API](https://loops.so/docs/api-reference/send-transactional-email)
- [Transactional template guide](https://loops.so/docs/transactional/guide)
- [Loops quickstart](https://loops.so/docs/quickstart)
