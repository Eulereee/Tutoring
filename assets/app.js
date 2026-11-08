// Shared code for every page: language, translations, Supabase client, header state, payments.
import { CONFIG } from "./config.js";
import { STRINGS } from "./i18n.js";
import { PRODUCTS } from "./products.js";

const LANGS = ["en", "th", "zh"];
const HTML_LANG = { en: "en", th: "th", zh: "zh-Hans" };

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } }

export function getLang() {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(fromUrl)) { storageSet("lang", fromUrl); return fromUrl; }
  const saved = storageGet("lang");
  if (LANGS.includes(saved)) return saved;
  const browser = (navigator.language || "").slice(0, 2);
  if (LANGS.includes(browser)) return browser;
  return CONFIG.DEFAULT_LANG;
}

let currentLang = getLang();

export function t(key) {
  const raw = STRINGS[currentLang]?.[key] ?? STRINGS.en[key] ?? key;
  return raw.replaceAll("{brand}", CONFIG.BRAND_NAME).replaceAll("{teacher}", CONFIG.TEACHER_NAME);
}

export function lang() { return currentLang; }

export function applyTranslations(root = document) {
  document.documentElement.lang = HTML_LANG[currentLang];
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll("[data-i18n-list]").forEach(el => {
    el.replaceChildren(...t(el.dataset.i18nList).split("|").map(text => {
      const li = document.createElement("li"); li.textContent = text; return li;
    }));
  });
  root.querySelectorAll("[data-brand]").forEach(el => { el.textContent = CONFIG.BRAND_NAME; });
  root.querySelectorAll("[data-line]").forEach(el => { el.href = CONFIG.LINE_URL; });
  root.querySelectorAll("[data-facebook]").forEach(el => { el.href = CONFIG.FACEBOOK_URL; });
  root.querySelectorAll("[data-email]").forEach(el => { el.href = "mailto:" + CONFIG.CONTACT_EMAIL; el.textContent = CONFIG.CONTACT_EMAIL; });
  root.querySelectorAll(".lang-switch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === currentLang)));
}

export function setLang(code) {
  if (!LANGS.includes(code)) return;
  currentLang = code;
  storageSet("lang", code);
  applyTranslations();
  document.dispatchEvent(new CustomEvent("langchange", { detail: code }));
}

// ---------- Supabase ----------
let clientPromise;
export function supabase() {
  if (!clientPromise) {
    clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY));
  }
  return clientPromise;
}

export function supabaseConfigured() {
  return !CONFIG.SUPABASE_URL.includes("YOUR-PROJECT") && !CONFIG.SUPABASE_ANON_KEY.includes("YOUR-ANON-KEY");
}

export async function currentSession() {
  if (!supabaseConfigured()) return null;
  const sb = await supabase();
  const { data } = await sb.auth.getSession();
  return data.session;
}

// ---------- Payments ----------
export async function startCheckout(productId, button) {
  const session = await currentSession();
  if (!session) {
    alert(t("pay.login"));
    location.href = "/login?next=" + encodeURIComponent("/dashboard?buy=" + productId);
    return;
  }
  if (button) button.disabled = true;
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ product: productId, lang: currentLang })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) throw new Error(body.error || res.statusText);
    location.href = body.url;
  } catch (err) {
    alert(t("pay.error") + err.message);
    if (button) button.disabled = false;
  }
}

export function productName(id) {
  const p = PRODUCTS[id];
  return p ? (p.name[currentLang] || p.name.en) : id;
}

export function formatTHB(n) {
  return new Intl.NumberFormat(HTML_LANG[currentLang], { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
}

// ---------- Header ----------
async function initHeader() {
  document.querySelectorAll(".lang-switch button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false");
    }));
  }

  const account = document.querySelector("[data-account-link]");
  if (account) {
    const session = await currentSession().catch(() => null);
    if (session) { account.href = "/dashboard"; account.dataset.i18n = "nav.dashboard"; account.textContent = t("nav.dashboard"); }
  }
}

applyTranslations();
initHeader();
