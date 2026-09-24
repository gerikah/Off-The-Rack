export function loopsFixture() {
  let calls, subscribers, contacts, options;
  function reset() {
    calls = [];
    subscribers = new Map([
      [
        "active@example.invalid",
        { email: "active@example.invalid", is_active: true },
      ],
      [
        "inactive@example.invalid",
        { email: "inactive@example.invalid", is_active: false },
      ],
    ]);
    contacts = new Map();
    options = {};
  }
  reset();
  return {
    reset,
    configure(value) {
      options = { ...options, ...value };
      if (value.expireCooldown) {
        const subscriber = subscribers.get(value.expireCooldown);
        if (subscriber) subscriber.attempted = 0;
      }
    },
    state: () => ({
      calls,
      subscribers: [...subscribers.values()],
      contacts: [...contacts.values()],
    }),
    signup(body) {
      const email = body.email_value.trim().toLowerCase();
      const current = subscribers.get(email);
      if (current?.is_active && Date.now() - current.attempted < 60000) {
        return { status: "already_subscribed", sync: false };
      }
      const status = !current
        ? "subscribed"
        : current.is_active
          ? "already_subscribed"
          : "reactivated";
      subscribers.set(email, { email, is_active: true, attempted: Date.now() });
      return { status, sync: true };
    },
    async handle(req, res, path, body) {
      if (!path.startsWith("/__loops/")) return false;
      const kind = path.endsWith("contacts/update")
        ? "contact"
        : path.endsWith("events/send")
          ? "welcome"
          : "transactional";
      calls.push({
        kind,
        method: req.method,
        body,
        idempotencyKey: req.headers["idempotency-key"],
      });
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      const status = options[kind + "Status"] || 200;
      if (kind === "contact" && status === 200) contacts.set(body.email, body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(
        options.malformed
          ? "not-json"
          : JSON.stringify(
              status === 200
                ? { success: true, id: "fixture-contact" }
                : {
                    success: false,
                    message: "PRIVATE PROVIDER ERROR MUST NOT LEAK",
                  },
            ),
      );
      return true;
    },
  };
}
