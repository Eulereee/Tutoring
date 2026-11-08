import { t, lang, supabase, supabaseConfigured, startCheckout, productName, formatTHB } from "./app.js";
import { PRODUCTS } from "./products.js";

if (!supabaseConfigured()) {
  document.querySelector(".dash .wrap").innerHTML =
    '<p class="notice">Supabase is not set up yet. Add your project URL and anon key to <code>assets/config.js</code>.</p>';
  throw new Error("Supabase not configured");
}

const sb = await supabase();
const { data: { session } } = await sb.auth.getSession();
if (!session) { location.replace("/login?next=" + encodeURIComponent(location.pathname + location.search)); throw new Error("not logged in"); }
const userId = session.user.id;

// ---------- helpers ----------
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}
const safeUrl = (u) => { try { const x = new URL(u); return ["http:", "https:"].includes(x.protocol) ? x.href : null; } catch { return null; } };
const fmtDate = (d) => new Intl.DateTimeFormat({ en: "en-GB", th: "th-TH", zh: "zh-CN" }[lang()], { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
function fill(listId, items, emptyKey) {
  const list = document.getElementById(listId);
  list.replaceChildren(...(items.length ? items : [el("li", { class: "empty", text: t(emptyKey) })]));
}
function formStatus(form, text, kind) { const s = form.querySelector(".status"); s.className = "status " + kind; s.textContent = text; }

document.getElementById("logout").addEventListener("click", async () => { await sb.auth.signOut(); location.href = "/"; });

// ---------- load ----------
let state = {};
async function load() {
  const [profile, courses, enrolments, links, resources, payments] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).single(),
    sb.from("courses").select("*").eq("active", true).order("code"),
    sb.from("enrolments").select("*").eq("user_id", userId).eq("status", "active"),
    sb.from("course_links").select("*"),
    sb.from("resources").select("*").order("created_at", { ascending: false }).limit(50),
    sb.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false })
  ]);
  state = {
    profile: profile.data,
    courses: courses.data || [],
    enrolments: enrolments.data || [],
    links: Object.fromEntries((links.data || []).map(l => [l.course_code, l])),
    resources: resources.data || [],
    payments: payments.data || []
  };
  state.isTeacher = state.profile?.role === "teacher";
  render();
  if (state.isTeacher) await loadTeacher();
}

const courseName = (code) => state.courses.find(c => c.code === code)?.name || code;

function render() {
  document.getElementById("who").textContent = state.profile?.full_name || session.user.email;

  const myCodes = new Set(state.enrolments.map(e => e.course_code));
  fill("classes", state.enrolments.map(e => {
    const link = state.links[e.course_code];
    const url = link && safeUrl(link.meeting_url);
    return el("li", {},
      el("div", {}, el("strong", { text: courseName(e.course_code) }), link?.schedule ? el("div", { class: "meta", text: link.schedule }) : null),
      url ? el("a", { class: "btn btn-pen btn-small", href: url, target: "_blank", rel: "noopener", text: t("dash.join") }) : null);
  }), "dash.noclasses");

  const visible = state.isTeacher ? state.resources : state.resources.filter(r => myCodes.has(r.course_code));
  fill("resources", visible.map(r => {
    const url = safeUrl(r.url);
    return el("li", {},
      el("div", {},
        url ? el("a", { href: url, target: "_blank", rel: "noopener", text: r.title }) : el("span", { text: r.title }),
        el("div", { class: "meta", text: courseName(r.course_code) + (r.due_on ? ` — ${t("dash.due")} ${fmtDate(r.due_on)}` : "") })));
  }), "dash.noresources");

  fill("payments", state.payments.map(p => el("li", {},
    el("div", {}, el("strong", { text: productName(p.product) }), el("div", { class: "meta", text: fmtDate(p.created_at) })),
    el("span", {}, el("span", { text: p.amount_thb != null ? formatTHB(p.amount_thb) + " " : "" }),
      el("span", { class: "badge done", text: p.status === "paid" ? t("dash.paid") : p.status })))), "dash.nopayments");

  const buy = document.getElementById("buy");
  buy.replaceChildren(...Object.entries(PRODUCTS).filter(([, p]) => p.price_thb != null).map(([id, p]) => {
    const b = el("button", { class: "btn btn-small", type: "button" }, `${productName(id)} — ${formatTHB(p.price_thb)}`);
    b.addEventListener("click", () => startCheckout(id, b));
    return b;
  }));

  document.querySelectorAll(".course-select").forEach(sel => {
    const keep = sel.value;
    sel.replaceChildren(...state.courses.map(c => el("option", { value: c.code, text: c.name })));
    if (keep) sel.value = keep;
  });
}

// ---------- teacher ----------
async function loadTeacher() {
  document.getElementById("teacher").hidden = false;
  const [enq, people, enrols] = await Promise.all([
    sb.from("enquiries").select("*").order("created_at", { ascending: false }).limit(50),
    sb.from("profiles").select("id, email, full_name, role").neq("role", "teacher").order("created_at", { ascending: false }),
    sb.from("enrolments").select("user_id, course_code").eq("status", "active")
  ]);

  fill("enquiries", (enq.data || []).map(q => {
    const markBtn = q.status === "new"
      ? el("button", { class: "btn btn-small", type: "button", text: t("teach.markdone"), onclick: async (e) => {
          e.target.disabled = true;
          await sb.from("enquiries").update({ status: "contacted" }).eq("id", q.id);
          loadTeacher();
        } })
      : null;
    return el("li", { class: "enquiry" },
      el("div", {}, el("span", { class: "who", text: `${q.student_name} (${q.parent_name}) ` }),
        el("span", { class: q.status === "new" ? "badge" : "badge done", text: q.status })),
      el("span", { class: "meta", text: `${q.level || ""} · ${q.subject || ""} · ${q.phone_or_line}${q.email ? " · " + q.email : ""} · ${fmtDate(q.created_at)}` }),
      q.message ? el("p", { style: "margin:.3rem 0 0", text: q.message }) : null,
      markBtn ? el("div", { class: "enquiry-actions" }, markBtn) : null);
  }), "teach.noenquiries");

  const byUser = {};
  for (const e of enrols.data || []) (byUser[e.user_id] ||= []).push(courseName(e.course_code));
  fill("students", (people.data || []).map(p => el("li", {},
    el("div", {}, el("strong", { text: p.full_name || p.email }), el("div", { class: "meta", text: `${p.email} · ${p.role}` })),
    el("span", { class: "meta", text: (byUser[p.id] || []).join(", ") }))), "teach.nostudents");
}

document.getElementById("enrol-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const email = document.getElementById("e-email").value.trim().toLowerCase();
  const { data: person } = await sb.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!person) return formStatus(form, t("teach.enrol.missing"), "err");
  const { error } = await sb.from("enrolments").upsert(
    { user_id: person.id, course_code: document.getElementById("e-course").value, status: "active" },
    { onConflict: "user_id,course_code" });
  if (error) return formStatus(form, error.message, "err");
  formStatus(form, t("teach.enrol.done"), "ok"); form.reset(); loadTeacher();
});

document.getElementById("resource-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const { error } = await sb.from("resources").insert({
    course_code: document.getElementById("r-course").value,
    title: document.getElementById("r-title").value.trim(),
    url: document.getElementById("r-url").value.trim() || null,
    due_on: document.getElementById("r-due").value || null
  });
  if (error) return formStatus(form, error.message, "err");
  formStatus(form, t("teach.resource.done"), "ok"); form.reset(); load();
});

document.getElementById("link-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const { error } = await sb.from("course_links").upsert({
    course_code: document.getElementById("k-course").value,
    meeting_url: document.getElementById("k-url").value.trim() || null,
    schedule: document.getElementById("k-schedule").value.trim() || null,
    updated_at: new Date().toISOString()
  });
  if (error) return formStatus(form, error.message, "err");
  formStatus(form, t("teach.link.done"), "ok"); load();
});

document.addEventListener("langchange", () => { render(); if (state.isTeacher) loadTeacher(); });

await load();

// Came from "Pay for a term" while logged out: continue to checkout.
const buyId = new URLSearchParams(location.search).get("buy");
if (buyId && PRODUCTS[buyId]?.price_thb != null) {
  history.replaceState(null, "", "/dashboard");
  startCheckout(buyId);
}
