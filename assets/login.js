import { t, supabase, supabaseConfigured } from "./app.js";

const status = document.getElementById("login-status");
const forms = {
  login: document.getElementById("form-login"),
  signup: document.getElementById("form-signup"),
  newpass: document.getElementById("form-newpass")
};
const tabs = { login: document.getElementById("tab-login"), signup: document.getElementById("tab-signup") };

function say(text, kind = "") { status.className = "status " + kind; status.textContent = text; }
function show(name) {
  for (const [k, f] of Object.entries(forms)) f.hidden = k !== name;
  for (const [k, b] of Object.entries(tabs)) b.setAttribute("aria-selected", String(k === name));
  say("");
}
tabs.login.addEventListener("click", () => show("login"));
tabs.signup.addEventListener("click", () => show("signup"));

// Only allow redirects to pages on this site.
function nextUrl() {
  const next = new URLSearchParams(location.search).get("next") || "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function client() {
  if (!supabaseConfigured()) throw new Error("Supabase is not set up yet (see assets/config.js).");
  return supabase();
}

forms.login.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const sb = await client();
    const { error } = await sb.auth.signInWithPassword({
      email: document.getElementById("l-email").value.trim(),
      password: document.getElementById("l-pass").value
    });
    if (error) throw error;
    location.href = nextUrl();
  } catch (err) { say(t("login.error") + err.message, "err"); }
});

forms.signup.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const sb = await client();
    const { data, error } = await sb.auth.signUp({
      email: document.getElementById("s-email").value.trim(),
      password: document.getElementById("s-pass").value,
      options: {
        data: { full_name: document.getElementById("s-name").value.trim(), role: document.getElementById("s-role").value },
        emailRedirectTo: location.origin + "/login"
      }
    });
    if (error) throw error;
    if (data.session) location.href = nextUrl();   // email confirmation turned off
    else { show("login"); say(t("login.check"), "ok"); }
  } catch (err) { say(t("login.error") + err.message, "err"); }
});

document.getElementById("forgot").addEventListener("click", async () => {
  const email = document.getElementById("l-email").value.trim();
  if (!email) { document.getElementById("l-email").focus(); return; }
  try {
    const sb = await client();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/login" });
    if (error) throw error;
    say(t("login.reset.sent"), "ok");
  } catch (err) { say(t("login.error") + err.message, "err"); }
});

forms.newpass.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const sb = await client();
    const { error } = await sb.auth.updateUser({ password: document.getElementById("n-pass").value });
    if (error) throw error;
    say(t("login.passsaved"), "ok");
    setTimeout(() => { location.href = "/dashboard"; }, 800);
  } catch (err) { say(t("login.error") + err.message, "err"); }
});

// Arriving from a password-reset email: show the "choose a new password" form.
if (supabaseConfigured()) {
  supabase().then(sb => sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") { show("newpass"); tabs.login.parentElement.hidden = true; }
  }));
}
