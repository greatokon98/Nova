# Nova — Change Log & Memory

## 2026-08-19 — Vercel + Neon Deployment Migration

### Summary
Migrated backend from SQLite (better-sqlite3) to PostgreSQL (Neon) for Vercel serverless deployment. All UI files untouched.

### Changes Made

#### `package.json`
- Removed: `better-sqlite3`, `express-rate-limit`
- Added: `pg`
- Updated description to reflect PostgreSQL

#### `db.js` — Complete Rewrite
- Replaced `better-sqlite3` synchronous API with `pg.Pool` async API
- Removed SQLite PRAGMAs (`journal_mode = WAL`, `foreign_keys = ON`)
- Changed `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- Changed `DEFAULT (datetime('now'))` → `DEFAULT (NOW()::TEXT)`
- Seed function now async, uses `$1`-`$11` parameterized queries
- Export: `{ pool, init }` instead of `{ db }`
- Added SSL config for production Neon connections

#### `server.js` — Major Refactor
- All route handlers converted from sync to async
- All 28 SQL queries: `?` placeholders → `$1, $2...` numbered parameters
- `db.prepare().all()` / `.get()` / `.run()` → `await pool.query()`
- `result.lastInsertRowid` → `RETURNING id` pattern
- Removed `app.listen()` conditional — kept for local dev, added `module.exports = app` for Vercel
- Removed `express.static()` — Vercel serves `public/` natively
- Removed `express-rate-limit` and both rate limiter instances
- Added env var validation: throws if `JWT_SECRET` or `ADMIN_PASSWORD` missing
- Added database readiness middleware (`dbReady` promise)
- Removed dead `now()` helper function
- Removed `getAll()` helper function
- Stats route uses `Promise.all()` for parallel queries
- All numeric results from COUNT/SUM cast with `Number()` for safety

#### `api/index.js` — New File
- Vercel serverless entry point
- Imports and re-exports Express app from `../server`

#### `vercel.json` — New File
- Routes `/api/*` to serverless function at `api/index.js`
- Routes `/admin` to `public/admin.html`
- All other routes serve from `public/`

### API Contract (Unchanged)
All routes, request/response shapes, and status codes preserved:
- `POST /api/login` — authenticate, set JWT cookie
- `POST /api/logout` — clear cookie
- `GET /api/auth-status` — check auth
- `GET /api/projects` — list (optional `?category=` filter)
- `GET /api/projects/:id` — single project
- `POST /api/projects` — create (auth required)
- `PUT /api/projects/:id` — update (auth required)
- `DELETE /api/projects/:id` — delete (auth required)
- `GET /api/inquiries` — list (auth required)
- `POST /api/inquiries` — submit (public)
- `PATCH /api/inquiries/:id` — update status (auth required)
- `DELETE /api/inquiries/:id` — delete (auth required)
- `GET /api/clients` — list (auth required)
- `POST /api/clients` — create (auth required)
- `PATCH /api/clients/:id` — update (auth required)
- `DELETE /api/clients/:id` — delete (auth required)
- `GET /api/stats` — dashboard stats (public)

### Environment Variables
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — Secret for signing JWT tokens (19f1107f70bf87a62a6315c317a04de5c444aa16000d3838a667bc86d0df344d)
- `ADMIN_PASSWORD` — Admin login password (nova_admin_2026!)
- `NODE_ENV` — Set to `production` on Vercel

### Smoke Test Results — ALL 21 PASSED
1. `GET /api/stats` — 6 projects, $201k revenue, 5 active clients
2. `GET /api/projects` — returns all 6 seeded projects
3. `GET /api/projects?category=Branding` — filtered correctly
4. `GET /api/projects/1` — single project returned
5. `GET /api/projects/999` — 404 error returned
6. `POST /api/inquiries` (public) — created with id:1
7. `POST /api/inquiries` (missing fields) — 400 validation error
8. `GET /api/auth-status` (no cookie) — `authenticated:false`
9. `POST /api/login` (wrong password) — 401 error
10. `POST /api/login` (correct password) — JWT cookie set
11. `GET /api/auth-status` (with cookie) — `authenticated:true`
12. `GET /api/inquiries` (auth) — returned test inquiry
13. `GET /api/clients` (auth) — returned 6 seeded clients
14. `POST /api/projects` (auth) — created with id:7
15. `GET /api/projects` — verified new project exists
16. `DELETE /api/projects/:id` (auth) — deleted successfully
17. `POST /api/clients` (auth) — created with id:7
18. `POST /api/logout` — cookie cleared
19. `GET /api/auth-status` (after logout) — `authenticated:false`
20. `GET /admin` — HTTP 200
21. `GET /` — HTTP 200

## 2026-08-19 — Vercel Deployment Fix (v2)

### Problem
Deployed to Vercel but production domain showed "No Production Deployment" error.

### Root Causes & Fixes

#### `server.js`
1. **`app.listen()` crashed serverless function** — moved inside `if (require.main === module)` guard so it only runs for local dev, not when required by `api/index.js`
2. **`process.exit(1)` on missing env vars** — replaced with graceful HTTP 500 responses instead of killing the process
3. **`process.exit(1)` on DB init failure** — changed to `dbReady = Promise.reject(err)` so the middleware returns 500 instead of crashing
4. **`express.static()` disabled in production** — removed the `NODE_ENV !== 'production'` guard; Vercel's CDN handles static files but Express static is harmless as fallback
5. **JWT_SECRET fallback `'fallback'` used in `jwt.sign()`/`jwt.verify()`** — replaced with inline fallback for safety

#### `vercel.json`
- Replaced deprecated `routes` config with modern `rewrites`
- Removed `routes` for static files (Vercel handles `public/` automatically)
- Added security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`)

#### `api/index.js`
- Changed from `module.exports = app` to `module.exports = (req, res) => app(req, res)` for proper Vercel handler export

#### `vercel.json` (v2 fix)
- Removed `builds` key entirely — Vercel auto-detects Express from `api/index.js` and static files from `public/`
- `builds` + `rewrites` together caused 404 because legacy Builder API skipped static file deployment

### Deployment Steps
1. Push to GitHub repo (https://github.com/greatokon98/Nova)
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard:
   - `DATABASE_URL` = Neon connection string
   - `JWT_SECRET` = `19f1107f70bf87a62a6315c317a04de5c444aa16000d3838a667bc86d0df344d`
   - `ADMIN_PASSWORD` = `nova_admin_2026!`
   - `NODE_ENV` = `production`
4. Vercel auto-deploys on push

### Files Untouched (UI)
- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `public/admin.html`
- `public/admin.css`
- `public/admin.js`
- `public/login.html`
- `public/login.js`
- `public/login.css`

---

## 2026-08-19 — Admin Auth Gate Fix

### Problem
`/admin` was served directly as a static file via Vercel rewrite, bypassing Express entirely. The admin page would flash before `admin.js` could check auth client-side and redirect to `/login.html`.

### Root Cause
`vercel.json` had `{ "source": "/admin", "destination": "/public/admin.html" }` — Vercel served the HTML file without any server-side auth check. `admin.js` then called `fetch('/api/auth-status')` to check auth, but the admin page was already visible.

### Fix

#### `vercel.json`
- Changed `/admin` rewrite from `/public/admin.html` to `/api/index.js`
- `/admin` now routes through Express serverless function

#### `server.js` — `/admin` route (line 78-85)
- Added server-side JWT cookie check before serving `admin.html`
- No valid token → `res.redirect('/login.html')` (HTTP 302, instant, no flash)
- Valid token → `res.sendFile('admin.html')` as before

### Flow After Fix
1. User visits `/admin` → Vercel routes to Express serverless function
2. Express checks `req.cookies.admin_token`
3. No token or invalid token → **instant 302 redirect** to `/login.html`
4. Valid token → serves `admin.html` (admin sees dashboard)
5. `/login.html` → if already authenticated, `login.js` redirects to `/admin`

### Commit
`39ab04a` — "fix: server-side /admin auth gate — no more flash of unauthenticated content"

---

## 2026-08-19 — Mobile Spacing & Footer Fix

### Changes

#### `public/styles.css` — line 514 (mobile media query)
- Added `.hero { min-height: auto; padding: 100px 20px 30px; }` inside `@media (max-width: 860px)`
- Removed forced `min-height: 100vh` on mobile so hero shrinks to content
- Reduced gap between stats counters and "Selected Work" section

#### `public/index.html` — line 199
- Footer text: "Built with care & a little SQLite." → "Design & manage by GEO creative studio."

### Commit
`5e6aaf9` — "fix: mobile hero gap + update footer text to GEO creative studio"

---

## Final Project State

### Tech Stack
- **Backend:** Express 5 + PostgreSQL (Neon) via `pg`
- **Auth:** JWT cookie (httpOnly, secure, SameSite strict, 12h expiry)
- **Hosting:** Vercel (serverless) + Neon (serverless Postgres)
- **Frontend:** Vanilla JS, no framework

### Environment Variables (Vercel Dashboard)
| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | `19f1107f70bf87a62a6315c317a04de5c444aa16000d3838a667bc86d0df344d` |
| `ADMIN_PASSWORD` | `nova_admin_2026!` |
| `NODE_ENV` | `production` |

### GitHub
- Repo: https://github.com/greatokon98/Nova
- Latest commit: `5e6aaf9`
