import { t, lang, supabase, supabaseConfigured, startCheckout, productName, applyTranslations } from "./app.js";
import { PRODUCTS } from "./products.js";

document.getElementById("year").textContent = new Date().getFullYear();

// Pay buttons for every product that has a price set in products.js
function renderPayButtons() {
  const group = document.getElementById("group-pay");
  const one = document.getElementById("one-pay");
  group.replaceChildren();
  one.querySelectorAll("[data-product]").forEach(b => b.remove());
  for (const [id, p] of Object.entries(PRODUCTS)) {
    if (p.price_thb == null) continue;
    const b = document.createElement("button");
    b.className = p.format === "group" ? "btn btn-pen btn-small" : "btn btn-small";
    b.dataset.product = id;
    b.textContent = productName(id);
    b.addEventListener("click", () => startCheckout(id, b));
    (p.format === "group" ? group : one).appendChild(b);
  }
}
renderPayButtons();
document.addEventListener("langchange", renderPayButtons);

// Trial lesson form -> Supabase "enquiries" table
const form = document.getElementById("trial-form");
const status = document.getElementById("trial-status");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  for (const k of Object.keys(data)) data[k] = String(data[k]).trim();
  if (!data.parent_name || !data.student_name || !data.phone_or_line) {
    status.className = "status full err"; status.textContent = t("trial.required"); return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true; button.textContent = t("trial.sending");
  status.className = "status full"; status.textContent = "";
  try {
    if (!supabaseConfigured()) throw new Error("Supabase not configured");
    const sb = await supabase();
    const { error } = await sb.from("enquiries").insert({ ...data, email: data.email || null, message: data.message || null, lang: lang() });
    if (error) throw error;
    form.reset();
    status.className = "status full ok"; status.textContent = t("trial.done");
  } catch (err) {
    console.error(err);
    status.className = "status full err"; status.textContent = t("trial.error");
  } finally {
    button.disabled = false; button.textContent = t("trial.submit");
  }
});

applyTranslations();
