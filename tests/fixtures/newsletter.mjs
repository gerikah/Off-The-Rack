// Local-only newsletter RPC double. Database semantics are tested with PGlite.
export function newsletterFixture() {
  let campaigns = [],
    legacy = 2,
    eligible = 3,
    unsubscribeHashes = [];
  return {
    reset() {
      campaigns = [];
      legacy = 2;
      eligible = 3;
      unsubscribeHashes = [];
    },
    state() {
      return { campaigns, legacy, eligible, unsubscribeHashes };
    },
    handle(table, body, admin) {
      if (table === "otr_newsletter_unsubscribe") {
        unsubscribeHashes.push(body.token_hash_value);
        return { status: 204 };
      }
      if (table !== "otr_newsletter_admin") return null;
      if (!admin)
        return { status: 403, data: { code: "42501", message: "denied" } };
      const { action, payload = {} } = body;
      if (action === "dashboard")
        return { status: 200, data: { campaigns, legacy, eligible } };
      if (action === "verify_legacy") {
        if (payload.confirmed !== true || payload.expected_count !== legacy)
          return { status: 200, data: { error: "count_changed" } };
        eligible += legacy;
        legacy = 0;
        return { status: 200, data: { ok: true } };
      }
      if (action === "create") {
        if (!campaigns.some((item) => item.id === payload.id))
          campaigns.unshift({
            id: payload.id,
            subject: payload.subject,
            body: payload.body,
            status: "draft",
            recipient_count: 0,
            sent_count: 0,
            skipped_count: 0,
            created_at: new Date().toISOString(),
            started_at: null,
            completed_at: null,
          });
        return { status: 200, data: { id: payload.id } };
      }
      return { status: 200, data: { error: "invalid_state" } };
    },
  };
}
