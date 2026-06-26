# Session Log — Phase 4: Authentication

**Date:** 2026-06-26
**Branch:** `develop`
**Commit:** `f5faef4`
**Session Status:** ✅ Complete

---

## Prompt

> Phase 4 — Authentication
> Build: Google OAuth, Session management, Secure token storage, User onboarding.

---

## Difference from Last Execution (Phase 3 — Backend Foundation)

Phase 3 built the **raw infrastructure** — database tables, engine, and one health endpoint. Nothing was connected. The frontend and backend were two completely isolated applications that had no awareness of each other.

Phase 4 built the **authentication bridge** that connects them:

| Area | Phase 3 (Infrastructure) | Phase 4 (Authentication) |
|---|---|---|
| Frontend ↔ Backend | No connection at all | Connected via `POST /auth/sync` after Google login |
| User identity | No user records in DB | Users upserted to `users` table on every login |
| Session tokens | None | 7-day HS256 JWT issued by FastAPI, stored in `sessionStorage` |
| Google tokens | Not stored | Saved to `connected_accounts` table for Phase 5 Gmail use |
| First-time users | No differentiation | Detected and redirected to `/dashboard/onboarding` |
| API protection | Only X-Agent-Secret | JWT Bearer auth added (`GET /auth/me`) |
| DB connection | Working but PgBouncer had prepared statement errors at runtime | Fixed by switching runtime to session mode pooler (port 5432) |

---

## What Was Built

### Backend

#### `app/services/auth_service.py` (NEW)
- `sync_google_user()` — upserts user via `UserRepository`, detects first-time sign-in
- `create_access_token()` — HS256 JWT signed with `AI_AGENT_SECRET`, 7-day expiry
- `verify_access_token()` — decodes and validates JWT, raises `JWTError` on failure

#### `app/repositories/connected_account_repo.py` (NEW)
- `upsert_google_tokens()` — stores Google `access_token`, `refresh_token`, `scopes`, `expires_at`
- `get_by_user_and_provider()` — retrieves tokens for Phase 5 Gmail API calls

#### `app/api/v1/auth.py` (NEW)
Two endpoints:
- `POST /api/v1/auth/sync` — protected by `X-Agent-Secret` header. Accepts Google profile + tokens, upserts user, saves tokens, returns `{ user, access_token, is_new_user }`
- `GET /api/v1/auth/me` — protected by `Bearer JWT`. Validates token, returns current `UserRead`

#### `app/main.py` (MODIFIED)
- Registered `auth_router` under `/api/v1`

#### `app/database.py` (MODIFIED)
- Switched connection URL from **port 6543** (PgBouncer transaction mode) to **port 5432** (session mode)
- Session mode supports asyncpg's extended query protocol / prepared statements
- Transaction mode does not — this was causing `DuplicatePreparedStatementError` on every DB call

### Frontend

#### `src/hooks/useAuthSync.ts` (NEW)
A React hook that runs automatically after every Google sign-in:
1. Checks if a JWT is already in `sessionStorage` — skips if yes
2. Calls `POST /api/v1/auth/sync` with Google profile data + `X-Agent-Secret`
3. Stores the returned JWT as `sc_access_token` in `sessionStorage`
4. Redirects new users to `/dashboard/onboarding`

#### `src/components/layout/DashboardLayout.tsx` (MODIFIED)
- Added `"use client"` directive (was previously a server component)
- Mounted `useAuthSync()` so the sync fires on the first dashboard load after login

#### `src/app/dashboard/onboarding/page.tsx` (NEW)
First-time user welcome screen:
- Personalised greeting using `session.user.name` from NextAuth
- 4 feature cards: Gmail Automation, AI Decision Engine, Human Approval, Instant Execution
- Single CTA button: "Go to Dashboard"

#### `src/middleware.ts` (MODIFIED)
- Added explicit pass-through for `/dashboard/onboarding` to prevent redirect loops

#### `frontend/.env.local` (MODIFIED)
- Fixed `NEXTAUTH_SECRET` with real OpenSSL-generated value
- Added `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_AGENT_SECRET` for `useAuthSync`

---

## Issues & Fixes

| Issue | Root Cause | Fix |
|---|---|---|
| `DuplicatePreparedStatementError` on all DB calls | Supabase port 6543 = PgBouncer **transaction mode** — blocks asyncpg's extended query protocol entirely | Changed `DATABASE_URL` to port **5432** (session mode pooler) which supports prepared statements |
| Alembic migrations still use port 6543 | psycopg2 doesn't use prepared statements by default → transaction mode works fine | Kept `ALEMBIC_DATABASE_URL` on port 6543 |

---

## Verification Results
- ✅ `POST /api/v1/auth/sync` → upserts user in Supabase, returns `{ user, access_token, is_new_user: false }`
- ✅ `GET /api/v1/auth/me` → JWT validated, returns `UserRead` with correct `email` and `name`
- ✅ Returning user detection working (`is_new_user: False` on second call with same `google_id`)
- ✅ User row `5e39173d-e9d4-4cb1-bc85-9e17bda06572` visible in Supabase `users` table
- ✅ Pushed to `develop` branch on GitHub (commit `f5faef4`)

---

## Key Architectural Decisions
- **JWT signed with `AI_AGENT_SECRET`** — reuses existing secret, no new key management needed
- **`sessionStorage` for JWT** — clears on tab close (appropriate for a single-user CEO tool)
- **Non-fatal sync** — if the backend is down, the frontend still works (user sees dashboard, just no sync)
- **Port split** — port 5432 (asyncpg runtime) vs port 6543 (psycopg2 Alembic) — different pooler modes for different drivers
- **Google tokens stored immediately** — `connected_accounts` populated at login so Phase 5 Gmail integration has tokens ready without a separate OAuth step
