// POST /api/stripe-webhook — Stripe calls this after a payment.
// Records the payment and, once it is paid, adds the student to the class.
// PromptPay can confirm a few moments after checkout, so "async_payment_succeeded" is handled too.
import { PRODUCTS } from "../assets/products.js";
import { env, json, supabaseAdmin, verifyStripeSignature } from "./_lib.js";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed"
]);

export async function POST(request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), env("STRIPE_WEBHOOK_SECRET"))) {
    return json(400, { error: "Invalid signature" });
  }

  const event = JSON.parse(raw);
  if (!HANDLED.has(event.type)) return json(200, { received: true, ignored: event.type });

  const s = event.data.object;
  const meta = s.metadata || {};
  const status =
    event.type === "checkout.session.async_payment_failed" ? "failed" :
    s.payment_status === "paid" ? "paid" : "pending";

  try {
    await supabaseAdmin("payments?on_conflict=stripe_session_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        stripe_session_id: s.id,
        user_id: meta.user_id || s.client_reference_id || null,
        email: s.customer_details?.email || s.customer_email || null,
        product: meta.product || null,
        course_code: meta.course_code || PRODUCTS[meta.product]?.course_code || null,
        amount_thb: s.amount_total != null ? s.amount_total / 100 : null,
        status
      }
    });

    if (status === "paid" && meta.user_id && meta.course_code) {
      await supabaseAdmin("enrolments?on_conflict=user_id,course_code", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { user_id: meta.user_id, course_code: meta.course_code, status: "active" }
      });
    }
  } catch (err) {
    console.error(err);
    return json(500, { error: "Could not record payment" }); // Stripe will retry
  }

  return json(200, { received: true });
}
