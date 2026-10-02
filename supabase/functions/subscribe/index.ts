import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN")?.trim();
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

async function unsubscribeCredentials(subscriberId: string, secret: string) {
  if (secret.length < 43) throw new Error("Invalid unsubscribe configuration.");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`otr-unsubscribe-v1:${subscriberId}`),
    ),
  );
  const token = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(token)),
  );
  return {
    token,
    hash: Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    ),
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return json({ error: "Origin not allowed." }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  const functionSecret = Deno.env.get("NEWSLETTER_FUNCTION_SECRET");
  if (
    !functionSecret ||
    functionSecret.length < 32 ||
    request.headers.get("x-newsletter-function-secret") !== functionSecret
  ) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object") {
      return json({ error: "Please submit valid form data." }, 400);
    }
    const body = input as Record<string, unknown>;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const startedAt = body.started_at;
    const elapsed =
      typeof startedAt === "number" ? Date.now() - startedAt : Number.NaN;

    if (body.website) {
      return json({
        mode: "live",
        status: "subscribed",
        emailStatus: "unchanged",
      });
    }
    if (
      body.consent !== true ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !Number.isFinite(elapsed) ||
      elapsed < 1200 ||
      elapsed > 86_400_000
    ) {
      return json(
        { error: "Please enter a valid email and agree to receive updates." },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("newsletter_supabase_not_configured");
      return json({ error: "Unable to subscribe right now." }, 503);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("otr_subscribe_newsletter", {
      email_value: email,
      consent_value: true,
    });
    if (error) {
      if (error.code === "P0001") {
        return json(
          { error: "Too many requests. Please try again shortly." },
          429,
        );
      }
      console.error("newsletter_database_error", { code: error.code });
      return json({ error: "Unable to subscribe right now." }, 503);
    }

    const subscription = data as {
      status?: unknown;
      sync?: unknown;
    } | null;
    if (
      !subscription ||
      !["subscribed", "already_subscribed", "reactivated"].includes(
        String(subscription.status),
      ) ||
      typeof subscription.sync !== "boolean"
    ) {
      console.error("newsletter_database_response_invalid");
      return json({ error: "Unable to subscribe right now." }, 503);
    }

    let emailStatus: "accepted" | "pending" | "unchanged" = "unchanged";
    if (subscription.sync && subscription.status !== "already_subscribed") {
      const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
      const templateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
      const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
      const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");
      const unsubscribeSecret = Deno.env.get("NEWSLETTER_UNSUBSCRIBE_SECRET");
      const configuredSiteUrl = Deno.env.get("NEWSLETTER_SITE_URL")?.trim();
      let siteUrl: string | undefined;
      try {
        const parsedSiteUrl = new URL(configuredSiteUrl || "");
        if (
          parsedSiteUrl.protocol === "https:" &&
          parsedSiteUrl.origin === configuredSiteUrl?.replace(/\/$/, "") &&
          !parsedSiteUrl.username &&
          !parsedSiteUrl.password
        ) {
          siteUrl = parsedSiteUrl.origin;
        }
      } catch {
        siteUrl = undefined;
      }
      if (
        !serviceId ||
        !templateId ||
        !publicKey ||
        !privateKey ||
        !unsubscribeSecret ||
        !siteUrl
      ) {
        console.error("newsletter_emailjs_not_configured");
        emailStatus = "pending";
      } else {
        try {
          const { data: subscriber, error: lookupError } = await supabase
            .from("newsletter_subscribers")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          if (lookupError || !subscriber?.id) {
            console.error("newsletter_unsubscribe_lookup_error", {
              code: lookupError?.code || "not_found",
            });
            return json({
              mode: "live",
              status: subscription.status,
              emailStatus: "pending",
            });
          }
          const { token, hash } = await unsubscribeCredentials(
            subscriber.id,
            unsubscribeSecret,
          );
          const { error: tokenError } = await supabase
            .from("newsletter_unsubscribe_tokens")
            .upsert(
              { token_hash: hash, subscriber_id: subscriber.id },
              { onConflict: "token_hash", ignoreDuplicates: true },
            );
          if (tokenError) {
            console.error("newsletter_unsubscribe_token_error", {
              code: tokenError.code,
            });
            return json({
              mode: "live",
              status: subscription.status,
              emailStatus: "pending",
            });
          }
          const response = await fetch(
            "https://api.emailjs.com/api/v1.0/email/send",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                service_id: serviceId,
                template_id: templateId,
                user_id: publicKey,
                accessToken: privateKey,
                template_params: {
                  to_email: email,
                  unsubscribe_url: `${siteUrl}/unsubscribe#${token}`,
                },
              }),
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(4000),
            },
          );
          if (response.ok) {
            emailStatus = "accepted";
          } else {
            console.error("newsletter_emailjs_error", {
              status: response.status,
            });
            emailStatus = "pending";
          }
        } catch {
          console.error("newsletter_emailjs_error", { kind: "network" });
          emailStatus = "pending";
        }
      }
    }

    return json({
      mode: "live",
      status: subscription.status,
      emailStatus,
    });
  } catch {
    console.error("newsletter_function_error");
    return json({ error: "Unable to subscribe right now." }, 500);
  }
});
