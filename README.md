# VKG Gate Management

Module 1 of the VKG Internal Application (Visitor / Gate / Employee Management).
This module covers **Gate Management**: digital check-in/check-out for staff and
visitors, vehicle capture, live dashboard, multi-site support, and reports.

This version is built to run on **Netlify** (hosting) + **Turso** (a hosted,
SQLite-compatible database) — so it's reachable from anywhere, including
guards on mobile data outside the office, not just your office WiFi.

---

## 1. What's included

- Login with sessions (bcrypt-hashed passwords, 8-hour session expiry, stored
  in a signed cookie — no server-side session storage needed)
- Two roles:
  - **Admin** — sees every site, manages users and sites
  - **Guard** — locked to their assigned site only
- Dashboard with live counts (today's entries, staff checked-in, vehicles, currently inside)
- Entry/Exit log: check in staff (Security/Housekeeping/MST/Pantry) or visitors
  (Maid/Driver/Delivery/Guest), optional vehicle number + type, one-click check-out
- Reports with filters (site, type, date range) and CSV export
- **Wings & Flats**: model your property structure (Site → Wing → Flat), so
  visitors can be linked to a specific flat instead of a free-text note
- **Flat Owner approvals**: create a login for a flat's owner, and any
  visitor entry logged for their flat needs their approval — shows
  **Pending** until they act, then **Approved** or **Rejected**, tracked
  separately from the physical **Inside/Checked-out** status
- Pre-seeded with your 5 sites: VKG Park Estate, Krishna Residences,
  VKG Business Centre, VKG Grandeur, VKG Solitaire — edit/add more under **Sites**
- Audit log table (logins, check-ins, check-outs, approvals) for accountability
- Fully responsive — works as an installable home-screen app on phones

---

## 2. Set up your database (Turso)

Turso gives you a free, hosted SQLite database — this is where all your gate
data actually lives.

1. Go to **https://turso.tech** and sign up (free tier is plenty for this).
2. Install the Turso CLI, or just use their web dashboard — the dashboard is
   simpler to start with:
   - Click **Create Database**, name it something like `vkg-gate`.
   - Pick a region close to Mumbai (e.g. Mumbai or Singapore) for lower latency.
3. Once created, open the database and find:
   - **Database URL** — looks like `libsql://vkg-gate-yourname.turso.io`
   - **Auth Token** — click **Create Token**, copy the value shown (you won't
     be able to see it again, so save it somewhere safe for now)

Keep both of these handy — you'll paste them into `.env` (local testing) and
into Netlify's environment variables (production) in the next steps.

---

## 3. Local test run (recommended before deploying)

Requires [Node.js](https://nodejs.org) v18 or newer.

```bash
cd vkg-gate
npm install
copy .env.example .env        REM (Mac/Linux: cp .env.example .env)
```

Open `.env` and fill in:
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — from step 2 above
- `SESSION_SECRET` — any long random string
- `ADMIN_DEFAULT_PASSWORD` — the password you want for the first admin login

> **Testing without a Turso account yet?** Leave `TURSO_DATABASE_URL` and
> `TURSO_AUTH_TOKEN` blank — the app automatically falls back to a local file
> database (`db/vkg_gate.local.db`) so you can try everything out first, then
> fill in real Turso credentials whenever you're ready to go live.

Then:

```bash
npm run seed      REM creates the sites and the admin user (in Turso, or the local file)
npm start         REM starts the app on http://localhost:3000
```

Log in with **username: `admin`** and the password you set. **Change it
immediately** from the Users page once you've confirmed everything works.

If you set real Turso credentials, this local run is talking to the same live
database your Netlify deployment will use — a good way to check everything
end-to-end before deploying.

---

## 4. Deploy to Netlify

**A. Push this project to GitHub** (Netlify deploys from a git repo)
1. Create a new repository on GitHub.
2. From inside the `vkg-gate` folder:
   ```bash
   git init
   git add .
   git commit -m "VKG Gate Management"
   git branch -M main
   git remote add origin https://github.com/<your-username>/vkg-gate.git
   git push -u origin main
   ```

**B. Connect it on Netlify**
1. Go to **https://app.netlify.com**, sign up/log in.
2. **Add new site → Import an existing project → GitHub** → pick your repo.
3. Build settings should auto-detect from `netlify.toml` (build command
   `npm install`, publish directory `public`, functions directory
   `netlify/functions`) — leave them as detected.
4. Before the first deploy, go to **Site configuration → Environment
   variables** and add:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `SESSION_SECRET` (use a different long random string than local, if you like)
   - `ADMIN_DEFAULT_PASSWORD` (only matters the first time you run the seed script)
   - `NODE_ENV` = `production`
5. Click **Deploy site**.

**C. Seed the production database (one-time)**
The seed script runs from your own machine, not on Netlify — it just needs
the same `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` in your local `.env` (which
you already set in step 3). If you haven't already:
```bash
npm run seed
```
This creates the sites and the `admin` user directly in your live Turso
database — Netlify doesn't need to do anything extra for this.

**D. Open your site**
Netlify gives you a URL like `https://vkg-gate-management.netlify.app`. Open
it, log in as `admin`, and change the password immediately. You can later add
a custom domain (e.g. `gate.vkgindia.com`) under **Domain settings** in Netlify.

That's it — this URL works from anywhere with internet access, office WiFi or
mobile data, no VPN or firewall rules needed.

---

## 5. Day-to-day admin

- **Add a security guard login:** Users → + Add User → role "Security Guard",
  assign their site. They'll only ever see that site's entries.
- **Add another site:** Sites → Add Site.
- **Set up wings, flats, and owner logins:** Wings & Flats (admin only) →
  add a Wing to a site, then add Flats to that wing (with the owner's name
  and phone as a record). Click **Create Login** on any flat to give that
  owner a username/password — once they have a login, any visitor entry
  logged for their flat automatically needs their approval.
- **How approvals work day-to-day:** when a guard checks in a visitor and
  picks a flat that has an owner login, the entry shows **Pending** until
  the owner logs in (or opens the app on their phone) and approves or
  rejects it from their **Approvals** page. Flats without an owner login
  skip approval entirely — the guard just checks the visitor in as normal.
- **Reset a forgotten password:** currently done via the database directly —
  ask me if you'd like a "reset password" button added to the Users page.
- **Back up your data:** Turso keeps your data hosted and replicated for you.
  For your own periodic exports, use the Turso CLI (`turso db shell vkg-gate
  ".dump" > backup.sql`) or the **Export** option in the Turso dashboard.
- **Redeploying after code changes:** just `git push` — Netlify automatically
  rebuilds and redeploys on every push to `main`.

---

## 6. Using it on a phone

The app is fully responsive — on a phone the sidebar becomes a slide-out menu
(tap the ☰ icon top-left).

**Add it to the home screen** so it opens like an app (no browser address bar):
- **Android (Chrome):** open your Netlify URL → tap **⋮** → **Add to Home
  screen** → **Install**.
- **iPhone (must be Safari, not Chrome):** open the site → tap **Share** →
  **Add to Home Screen**.

Because it's hosted on Netlify (not just your office network), this now works
over mobile data too — guards can check people in/out from anywhere.

---

## 7. Alternative: running it on your own Windows Server instead

If you'd rather keep everything in-house instead of using Netlify/Turso, this
same app can run as a regular Node process on your Windows Server (behind
IIS or directly on a port), using a local SQLite file instead of Turso —
ask me and I'll walk you through that version's setup again; the code paths
for both are already compatible (just don't set `TURSO_DATABASE_URL` and it
uses a local file automatically), though for a permanent in-house deployment
you'd want to switch the session store back to a persistent one rather than
cookie-only, since a single Windows service doesn't have the same constraints
a serverless function does.

---

## 8. What's next

This is Gate Management only — Module 1 of the 3 shown in your deck. Visitor
Management and Employee Management can be added as further modules in the
same app (same login, same database, new menu items) whenever you're ready —
just say the word and I'll build the next one.
