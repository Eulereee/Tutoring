// POST /api/checkout  { product: "ks3_maths_group", lang: "th" }
// Starts a Stripe Checkout payment (PromptPay or card, in THB) for a logged-in user.
import { PRODUCTS } from "../assets/products.js";
import { json, stripe, userFromToken } from "./_lib.js";

const STRIPE_LOCALE = { en: "en", th: "th", zh: "zh" };

export async function POST(request) {
  try {
    const { product: productId, lang = "en" } = await request.json().catch(() => ({}));
    const product = PRODUCTS[productId];
    if (!product || product.price_thb == null) return json(400, { error: "This course can't be paid online yet." });

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const user = await userFromToken(token);
    if (!user?.id) return json(401, { error: "Please log in first." });

    const origin = process.env.SITE_URL || new URL(request.url).origin;
    const metadata = { product: productId, course_code: product.course_code, user_id: user.id };

    const session = await stripe("checkout/sessions", {
      mode: "payment",
      // Payment methods (card, PromptPay) come from your Stripe Dashboard settings.
      line_items: {
        0: {
          quantity: 1,
          price_data: {
            currency: "thb",
            unit_amount: Math.round(product.price_thb * 100), // satang
            product_data: { name: product.name[lang] || product.name.en }
          }
        }
      },
      customer_email: user.email,
      client_reference_id: user.id,
      metadata,
      payment_intent_data: { metadata },
      locale: STRIPE_LOCALE[lang] || "auto",
      success_url: `${origin}/paid?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/paid?status=cancel`
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Payment could not be started. Please try again or contact us." });
  }
}
