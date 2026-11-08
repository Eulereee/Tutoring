// Shared server helpers for the Vercel functions. Files starting with "_" are not routes.
import crypto from "node:crypto";

export function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Look up the logged-in user from the Supabase access token sent by the browser.
export async function userFromToken(token) {
  if (!token) return null;
  const res = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

// Write to Supabase with the service role key (bypasses Row Level Security; server only).
export async function supabaseAdmin(path, { method = "GET", body, prefer } = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

// Call the Stripe API without the Stripe package (form-encoded, as Stripe expects).
export function formEncode(obj, prefix = "") {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") parts.push(formEncode(v, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return parts.filter(Boolean).join("&");
}

export async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode(params)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `Stripe error ${res.status}`);
  return body;
}

// Verify the Stripe-Signature header (https://docs.stripe.com/webhooks#verify-manually).
export function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300, now = Date.now()) {
  if (!header) return false;
  let timestamp = null;
  const signatures = [];
  for (const piece of header.split(",")) {
    const [k, v] = piece.split("=");
    if (k === "t") timestamp = v;
    if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  return signatures.some(sig => {
    const b = Buffer.from(sig, "hex");
    return b.length === a.length && crypto.timingSafeEqual(a, b);
  });
}
