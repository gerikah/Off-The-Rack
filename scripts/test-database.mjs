// Real PostgreSQL semantics in an isolated in-memory WASM runtime. No network/credentials.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = await PGlite.create();
const admin = "40000000-0000-4000-8000-000000000000",
  member = "40000000-0000-4000-8000-000000000001";
const product = "20000000-0000-4000-8000-000000000000",
  other = "20000000-0000-4000-8000-000000000001";
let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
const denied = async (sql, params = []) => {
  await assert.rejects(db.query(sql, params));
  checks++;
};
async function role(name, id = "") {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
    [id, name],
  );
  if (name !== "postgres") await db.exec("set role " + name);
}
async function rpc(action, payload = {}) {
  return (
    await db.query(
      "select public.otr_newsletter_admin($1,$2::jsonb) as result",
      [action, JSON.stringify(payload)],
    )
  ).rows[0].result;
}
async function owner(sql, params = []) {
  await role("postgres");
  return db.query(sql, params);
}
try {
  await db.exec(await readFile("tests/fixtures/database.sql", "utf8"));
  const migrations = [
    "002_admin_access.sql",
    "003_product_images.sql",
    "004_newsletter.sql",
    "005_submission_security.sql",
    "006_loops_subscriptions.sql",
    "007_product_image_workflow.sql",
    "008_product_image_public_read.sql",
    "009_restore_product_image_rpcs.sql",
  ];
  for (let pass = 0; pass < 2; pass++)
    for (const name of migrations) {
      await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
    }
  equal(
    (await db.query("select count(*)::int as n from public.products")).rows[0]
      .n,
    2,
    "replay preserves inventory",
  );
  equal(
    (
      await db.query(
        "select count(*)::int as n from public.newsletter_subscribers",
      )
    ).rows[0].n,
    2,
    "replay preserves subscribers",
  );
  await db.query("insert into public.admin_users(id) values($1)", [admin]);
  await role("anon");
  equal(
    (await db.query("select count(*)::int as n from public.products")).rows[0]
      .n,
    2,
    "public catalog readable",
  );
  await denied("select * from public.newsletter_subscribers");
  await denied("select * from public.inquiries");
  await denied("select * from public.admin_users");
  await denied(
    "insert into public.products(name,slug,price) values('forged','forged',1)",
  );
  await denied("update public.products set price=1 returning id");
  await denied(
    "insert into storage.objects(bucket_id,name) values('product-images','attack.webp')",
  );
  await role("authenticated", member);
  equal(
    (await db.query("select public.otr_is_admin() as allowed")).rows[0].allowed,
    false,
    "ordinary member denied",
  );
  equal(
    (await db.query("select * from public.newsletter_subscribers")).rows.length,
    0,
    "ordinary member sees no subscriber rows",
  );
  await denied("insert into public.admin_users(id) values($1)", [member]);
  equal(
    (await db.query("update public.products set price=1 returning id")).rows
      .length,
    0,
    "member cannot mutate catalog",
  );
  await denied("select public.otr_newsletter_admin('dashboard','{}')");
  await denied("select * from public.newsletter_unsubscribe_tokens");
  await role("anon");
  await db.query(
    "insert into public.inquiries(customer_name,email,inquiry_type,message,status) values('Test person','PERSON@example.invalid','general','A valid inquiry message.','resolved')",
  );
  await denied(
    "insert into public.inquiries(customer_name,email,inquiry_type,message) values('Test person','person@example.invalid','general','Repeated inquiry too soon.')",
  );
  await denied(
    "insert into public.inquiries(customer_name,email,inquiry_type,message,created_at) values('Test person','forged@example.invalid','general','A valid inquiry message.','2000-01-01')",
  );
  await denied(
    "insert into public.inquiries(customer_name,email,inquiry_type,message) values('Test person','other@example.invalid','general','short')",
  );
  const inquiry = await owner(
    "select email,status,consent_version from public.inquiries",
  );
  equal(
    inquiry.rows[0],
    {
      email: "person@example.invalid",
      status: "new",
      consent_version: "inquiry-contact-v1",
    },
    "inquiry field guard",
  );
  await role("authenticated", admin);
  equal(
    (await db.query("select public.otr_is_admin() as allowed")).rows[0].allowed,
    true,
    "admin authorized",
  );
  equal(
    (await db.query("update public.products set featured=true returning id"))
      .rows.length,
    2,
    "admin can update",
  );
  const path = `products/${product}/50000000-0000-4000-8000-000000000000.webp`;
  await denied(
    "insert into storage.objects(bucket_id,name) values('product-images','bad.webp')",
  );
  await db.query(
    "insert into storage.objects(bucket_id,name) values('product-images',$1)",
    [path],
  );
  const imageData = {
    image_url:
      "https://example.supabase.co/storage/v1/object/public/product-images/" +
      path,
    storage_path: path,
    alt_text: "Painted jacket front",
  };
  for (const id of [product, other])
    await db.query("select public.otr_save_product_image($1,null,$2::jsonb)", [
      id,
      JSON.stringify(imageData),
    ]);
  equal(
    (await db.query("select public.otr_claim_image_cleanup($1) as ok", [path]))
      .rows[0].ok,
    false,
    "referenced file cannot be claimed",
  );
  equal(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        path,
      ])
    ).rows.length,
    0,
    "referenced file deletion denied",
  );
  let imgs = (
    await db.query(
      "select id,product_id from public.product_images order by product_id",
    )
  ).rows;
  await db.query("select public.otr_remove_product_image($1,$2)", [
    imgs[0].product_id,
    imgs[0].id,
  ]);
  equal(
    (
      await db.query(
        "select count(*)::int as n from public.product_image_cleanup",
      )
    ).rows[0].n,
    0,
    "shared file kept",
  );
  await db.query("select public.otr_remove_product_image($1,$2)", [
    imgs[1].product_id,
    imgs[1].id,
  ]);
  equal(
    (
      await db.query(
        "select count(*)::int as n from public.product_image_cleanup",
      )
    ).rows[0].n,
    1,
    "unreferenced file queued",
  );
  await denied("select public.otr_save_product_image($1,null,$2::jsonb)", [
    product,
    JSON.stringify(imageData),
  ]);
  equal(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        path,
      ])
    ).rows.length,
    1,
    "claimed file removable",
  );

  for (let i = 0; i < 12; i++) {
    const path =
      "products/" +
      product +
      "/50000000-0000-4000-8000-" +
      String(i + 1).padStart(12, "0") +
      ".webp";
    await db.query("select public.otr_save_product_image($1,null,$2::jsonb)", [
      product,
      JSON.stringify({
        image_url:
          "https://example.supabase.co/storage/v1/object/public/product-images/" +
          path,
        storage_path: path,
        alt_text: "Gallery photo " + i,
      }),
    ]);
  }
  const extra = {
    ...imageData,
    storage_path:
      "products/" + product + "/50000000-0000-4000-8000-000000000099.webp",
  };
  await denied("select public.otr_save_product_image($1,null,$2::jsonb)", [
    product,
    JSON.stringify(extra),
  ]);
  const covers = (
    await db.query(
      "select id from public.product_images where product_id=$1 order by sort_order",
      [product],
    )
  ).rows;
  await db.query("select public.otr_save_product_image($1,$2,$3::jsonb)", [
    product,
    covers[4].id,
    JSON.stringify({ alt_text: "New cover", is_primary: true }),
  ]);
  equal(
    (
      await db.query(
        "select id from public.product_images where product_id=$1 and is_primary",
        [product],
      )
    ).rows,
    [{ id: covers[4].id }],
    "cover change is exclusive",
  );
  await db.query("select public.otr_remove_product_image($1,$2)", [
    product,
    covers[4].id,
  ]);
  equal(
    (
      await db.query(
        "select id from public.product_images where product_id=$1 and is_primary",
        [product],
      )
    ).rows,
    [{ id: covers[0].id }],
    "removed cover promotes first image",
  );
  equal((await rpc("dashboard")).eligible, 0, "legacy consent is not invented");
  await role("anon");
  equal(
    (
      await db.query(
        "select count(*)::int as n from public.product_images where product_id=$1",
        [product],
      )
    ).rows[0].n,
    11,
    "public storefront can read product images",
  );
  await db.query(
    "insert into public.newsletter_subscribers(email,is_active) values('NEW@example.invalid',true)",
  );
  await denied(
    "insert into public.newsletter_subscribers(email,is_active) values(' new@example.invalid ',true)",
  );
  await denied(
    "insert into public.newsletter_subscribers(email,is_active,consent_source) values('forged@example.invalid',true,'legacy_verified')",
  );
  await denied(
    "insert into public.newsletter_subscribers(email,is_active) values('inactive@example.invalid',true)",
  );
  await role("authenticated", admin);
  equal(
    (await rpc("dashboard")).eligible,
    1,
    "only active verified consent eligible",
  );
  await rpc("verify_legacy", { confirmed: true, expected_count: 1 });
  equal(
    (await rpc("dashboard")).eligible,
    2,
    "admin confirms preexisting consent",
  );
  const campaign = "60000000-0000-4000-8000-000000000000";
  const draft = {
    id: campaign,
    subject: "A new hand painted drop",
    body: "A valid fixture newsletter with enough text.",
  };
  await rpc("create", draft);
  await rpc("create", draft);
  equal((await rpc("dashboard")).campaigns.length, 1, "repeat save idempotent");
  equal(
    (await rpc("start", { id: campaign, confirmed: true, expected_count: 99 }))
      .error,
    "count_changed",
    "count recheck",
  );
  await rpc("start", { id: campaign, confirmed: true, expected_count: 2 });
  await rpc("start", { id: campaign, confirmed: true, expected_count: 2 });
  const batch = await rpc("claim", { id: campaign });
  equal(batch.recipients.length, 2, "bounded eligible batch");
  equal(
    (await rpc("claim", { id: campaign })).error,
    "busy",
    "parallel claim lease",
  );
  const tokens = batch.recipients.map((r, i) => ({
    id: r.id,
    hash: String(i + 1).repeat(64),
  }));
  await rpc("prepare", {
    id: campaign,
    batch_id: batch.batch_id,
    payload_hash: "a".repeat(64),
    tokens,
  });
  await rpc("complete", {
    id: campaign,
    batch_id: batch.batch_id,
    provider_ids: batch.recipients.map((_, i) => "provider-" + i),
  });
  equal(
    (await rpc("claim", { id: campaign })).done,
    true,
    "completed campaign never requeues",
  );
  await role("anon");
  await db.query("select public.otr_newsletter_unsubscribe($1)", [
    tokens[0].hash,
  ]);
  await db.query("select public.otr_newsletter_unsubscribe($1)", [
    tokens[0].hash,
  ]);
  await db.query("select public.otr_newsletter_unsubscribe($1)", [
    "0".repeat(64),
  ]);
  const sub = await owner(
    "select is_active,unsubscribed_at from public.newsletter_subscribers where id=$1",
    [tokens[0].id],
  );
  equal(sub.rows[0].is_active, false, "unsubscribe idempotent");
  assert.ok(sub.rows[0].unsubscribed_at);
  checks++;
  await role("authenticated", admin);
  const uncertain = "60000000-0000-4000-8000-000000000001";
  await rpc("create", { ...draft, id: uncertain });
  await rpc("start", { id: uncertain, confirmed: true, expected_count: 1 });
  await owner(
    "update public.newsletter_rate_limits set touched_at=now()-interval '1 minute'",
  );
  await role("authenticated", admin);
  const old = await rpc("claim", { id: uncertain });
  await owner(
    "update public.newsletter_batches set created_at=now()-interval '25 hours',last_attempt_at=now()-interval '25 hours' where id=$1",
    [old.batch_id],
  );
  await role("authenticated", admin);
  equal(
    (await rpc("claim", { id: uncertain })).error,
    "paused",
    "uncertain old batch never retried",
  );
  // 006: real SQL constraints, atomic subscription lifecycle, and no read/update grants.
  await role("anon");
  const subscribe = async (email, consent = true) =>
    (
      await db.query(
        "select public.otr_subscribe_newsletter($1,$2) as result",
        [email, consent],
      )
    ).rows[0].result;
  equal(
    await subscribe("  LOOPS@EXAMPLE.INVALID  "),
    { status: "subscribed", sync: true },
    "new signup normalizes and records consent",
  );
  equal(
    await subscribe("loops@example.invalid"),
    { status: "already_subscribed", sync: false },
    "rapid duplicate does not repeat provider work",
  );
  await denied("select * from public.newsletter_signup_attempts");
  await denied("delete from public.newsletter_signup_attempts");
  await denied("select public.otr_subscribe_newsletter('invalid',true)");
  await denied(
    "select public.otr_subscribe_newsletter('consent@example.invalid',false)",
  );
  await denied(
    "select public.otr_subscribe_newsletter('consent@example.invalid',null)",
  );
  await denied(
    "update public.newsletter_subscribers set is_active=true where email='inactive@example.invalid'",
  );
  const before = await owner(
    "select id,created_at from public.newsletter_subscribers where email='inactive@example.invalid'",
  );
  await role("anon");
  equal(
    await subscribe("inactive@example.invalid"),
    { status: "reactivated", sync: true },
    "fresh consent reactivates existing row",
  );
  const after = await owner(
    "select id,created_at,is_active,consent_source,unsubscribed_at from public.newsletter_subscribers where email='inactive@example.invalid'",
  );
  equal(
    after.rows[0],
    {
      ...before.rows[0],
      is_active: true,
      consent_source: "storefront_signup",
      unsubscribed_at: null,
    },
    "reactivation preserves identity and creation time",
  );
  equal(
    (
      await db.query(
        "select count(*)::int as n from public.newsletter_subscribers where lower(trim(email))='loops@example.invalid'",
      )
    ).rows[0].n,
    1,
    "duplicate did not create a row",
  );
  await db.query(
    "update public.newsletter_signup_attempts set created_at=now()-interval '2 minutes'",
  );
  await role("authenticated", member);
  equal(
    await subscribe("loops@example.invalid"),
    { status: "already_subscribed", sync: true },
    "ordinary member may explicitly resubmit after cooldown",
  );
  equal(
    (await db.query("select * from public.newsletter_subscribers")).rows,
    [],
    "signup does not grant subscriber reads",
  );
  await role("postgres");
  equal(
    (
      await db.query(
        "select count(*)::int as n from pg_indexes where indexname='otr_newsletter_normalized_unique' and indexdef like 'CREATE UNIQUE%'",
      )
    ).rows[0].n,
    1,
    "normalized email uniqueness enforced in database",
  );
  await db.query(
    "insert into public.newsletter_signup_attempts(email_hash) select md5('quota-'||n::text) from generate_series(1,30) n",
  );
  await role("anon");
  await denied(
    "select public.otr_subscribe_newsletter('quota@example.invalid',true)",
  );
  await role("postgres");
  const unprotected = (
    await db.query(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    )
  ).rows;
  equal(unprotected, [], "every application table has RLS");
  console.log(
    `Database verification passed: ${checks} assertions; migrations 002-009 replayed twice; no live services.`,
  );
} catch (error) {
  console.error("Database verification failed:", {
    checks,
    message: error.message,
    code: error.code,
    where: error.where,
  });
  process.exitCode = 1;
} finally {
  await db.close();
}
