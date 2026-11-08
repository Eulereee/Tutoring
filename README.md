# Maths & Science Tutor website

A tutoring website in English, Thai and Chinese that runs on your existing **GitHub + Vercel + Supabase** setup, with **Stripe** for PromptPay and card payments.

- **Public site**: courses, prices, how lessons work, about you, free-trial booking form, LINE button
- **Logins**: parents and students create accounts; they see their classes, the lesson link, notes and homework, and payments
- **Teacher area** (only your account): trial requests, students, add a student to a class, post notes/homework, set each class's Zoom/Meet link and time
- **Payments**: "Pay for a term" opens Stripe Checkout in THB (PromptPay or card). When payment clears, the student is added to the class automatically.

No build step and no packages to install: plain HTML/CSS/JS plus two small Vercel functions.

```
index.html          public homepage
login.html          log in / create account / reset password
dashboard.html      student, parent and teacher area
paid.html           after Stripe payment
assets/config.js    ← your business name, LINE link, Supabase keys
assets/products.js  ← courses and prices (used by the site AND the payment server)
assets/i18n.js      ← all wording in English, Thai and Chinese
api/checkout.js     starts a Stripe payment
api/stripe-webhook.js  records payments and enrols the student
supabase/schema.sql tables and security rules
```

## 1. GitHub
1. Create a new **private** repo on GitHub (e.g. `tutoring-site`).
2. Upload these files to it (drag the folder contents into the repo page, or `git init && git add . && git commit -m "First version" && git push`).

## 2. Supabase
You can use a new Supabase project (recommended, keeps it separate from Maths Live) or your existing one.
1. **SQL Editor → New query**: paste all of `supabase/schema.sql` → **Run**.
2. **Project Settings → API**: copy the **Project URL** and **anon public key** into `assets/config.js`.
   Copy the **service_role key** too, but keep it secret (it goes in Vercel only, step 3).
3. **Authentication → URL Configuration**: set **Site URL** to your Vercel address (e.g. `https://your-site.vercel.app`) and add `https://your-site.vercel.app/login` to **Redirect URLs**.

## 3. Vercel
1. **Add New → Project** → import the GitHub repo. Framework preset: **Other**. No build command. Deploy.
2. **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (secret) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | from step 4 (`whsec_…`) |
| `SITE_URL` | optional, e.g. `https://yourdomain.com` |

3. Redeploy so the variables take effect.
4. **Make yourself the teacher**: create an account on the site, then in Supabase SQL Editor run
   `update public.profiles set role = 'teacher' where email = 'your@email.com';`

## 4. Stripe (needs the Thai business that will receive the money)
1. Create the Stripe account in the name of the registered Thai business. Start in **Test mode**.
2. **Settings → Payment methods**: make sure **Cards** and **PromptPay** are on.
3. **Developers → Webhooks → Add endpoint**: URL `https://your-site.vercel.app/api/stripe-webhook`, events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
   Copy the **signing secret** into `STRIPE_WEBHOOK_SECRET` on Vercel.
4. Test with card `4242 4242 4242 4242`, any future date, any CVC. Check the payment appears in your dashboard and the student is in the class. Then switch to live keys.

## Everyday edits
- **Business name, LINE, Facebook, email**: `assets/config.js`
- **Prices / courses**: `assets/products.js`. Set `price_thb` on the one-to-one products to add a Pay button for them. New classes also need a row in the Supabase `courses` table with the same `course_code`.
- **Wording**: `assets/i18n.js` (have a native speaker check the Thai and Chinese before launch).
- **Custom domain**: Vercel → Settings → Domains.

## How a family uses it
1. Books a free trial on the homepage → it appears in your **Trial requests**.
2. Creates an account → you add them to a class (or they pay for a term and are added automatically).
3. They log in to find the lesson link, notes and homework.

## Notes
- Parents and students each create their own account; a parent paying puts the class on the parent's account. If a student needs their own login too, add both to the class.
- Online payment isn't legally ready until the Thai business, work-permit and tax questions are settled. The site can go live for trial bookings before that, with payments left in Stripe test mode.
