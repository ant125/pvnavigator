# PVNavigator Authentication Architecture

This document is the canonical authentication reference for the PVNavigator
platform. Application code, Vercel project settings, and new services must
follow it.

## Goals

PVNavigator is one product with several applications. Authentication is a
platform concern, not a per-app feature.

- **One account.** A user has a single PVNavigator identity.
- **One login.** Credentials are collected only on the Hub.
- **One Supabase project.** Every application validates sessions against the
  same Auth project.
- **Shared authentication.** After login, every `*.pvnavigator.de` application
  must see the same session.

No application may introduce a second login, a cookie-copy bridge, a hash
handoff, or a service-specific Auth project.

## Current services

| Host | Application | Role |
|---|---|---|
| `pvnavigator.de` | Hub (`apps/pvnavigator-web`) | Account, login, signup, logout, session writer |
| `speicher.pvnavigator.de` | SpeicherGrenze (`apps/speicher-physik`) | Session reader; calculation requires an account |

## Future services

These hosts must join the same architecture without additional login UI:

- `wirtschaft.pvnavigator.de`
- `pvshadow.pvnavigator.de`
- any other `*.pvnavigator.de` application

---

# Architecture

## Shared Supabase project

All PVNavigator applications use one Supabase project. The project issues the
JWT, stores users, and answers `getUser()`. A cookie written by the Hub is
useless on another subdomain if that app calls a different project or a
malformed project URL.

## Shared authentication

The browser holds one parent-domain session cookie. Hub and every product
subdomain send that cookie on subsequent requests. Middleware and server
components on each app reconstruct the Supabase client with the same cookie
name and options, then call `supabase.auth.getUser()`.

Identity is established server-side. Client-only `getSession()` is not the
authorization path.

## No service-specific login

SpeicherGrenze, and every future product, must not collect email/password.
Unauthenticated access to a protected route redirects to Hub login:

```
https://pvnavigator.de/anmelden?next=speicher-calculate
```

Approved `next` aliases map to a fixed product URL. Arbitrary external URLs
are rejected.

## One authentication flow

Shared helpers live in `packages/auth-session` (`@pv-auth/session`). Hub
session mutations run in Route Handlers and persist cookies with raw
`Set-Cookie` headers (`redirectWithAuthCookies`). They must not use
`cookies().set()`, which creates a host-only cookie on `pvnavigator.de` that
subdomains never receive.

## Login flow

1. The user opens a protected product URL, or Hub `/anmelden`.
2. If the product has no valid session, it 307s to Hub `/anmelden` with an
   approved `next` alias.
3. Hub renders the login form. The form `POST`s to `/auth/sign-in`.
4. `/auth/sign-in` authenticates against the shared Supabase project.
5. On success it writes `sb-pvnav-auth` with `Domain=.pvnavigator.de` and
   303s to the post-login location (`/konto`, or the product URL for an
   approved alias).
6. Signup uses `/auth/sign-up` on the same cookie pipeline. If email
   confirmation is required, no session cookie is written; `/auth/callback`
   writes the shared session after confirmation.
7. Every subsequent request to `pvnavigator.de` or `*.pvnavigator.de` includes
   the parent-domain cookie. Each app’s middleware and `getServerUser()` call
   `getUser()` against the **same** project URL and anon key.
8. Logout is Hub `POST /auth/sign-out`. It expires the shared cookie and
   leftover legacy names on both parent-domain and host-only scopes.

If Hub `getUser()` returns a user and a product `getUser()` returns null, the
user will bounce between Hub `/anmelden` and the product URL until the
browser stops with `ERR_TOO_MANY_REDIRECTS`. That is always a configuration
or cookie-scope failure, not a reason to add a second login.

---

# Shared Cookie

## Name

```
sb-pvnav-auth
```

Constant: `SHARED_AUTH_COOKIE_NAME` in `@pv-auth/session`.

Supabase may also set `sb-pvnav-auth-code-verifier` (PKCE) and chunked names
(`sb-pvnav-auth.0`, …). Those use the same Domain / Path / SameSite / Secure
rules. They are not a second session.

## Production settings

| Attribute | Value |
|---|---|
| Name | `sb-pvnav-auth` |
| Domain | `.pvnavigator.de` |
| Path | `/` |
| SameSite | `Lax` |
| Secure | `true` |

Localhost omits `Domain` so the cookie stays host-only on `localhost`.

Do not write a live session as a host-only `sb-pvnav-auth` on `pvnavigator.de`.
Chrome will use that host-only cookie on the Hub and will **not** send it to
`speicher.pvnavigator.de`. Do not write `sb-<project-ref>-auth-token` as the
active session. Login, callback, and logout expire leftover legacy names.

## Why every application must use identical cookie configuration

The browser stores one cookie for the parent domain. Every app must:

- read the same name (`sb-pvnav-auth`), via `getAuthCookieOptions()`
- expect `Domain=.pvnavigator.de` in production
- validate the JWT with the same Supabase project

If one app uses a different cookie name, a host-only Domain, or a different
Supabase project, Hub can be logged in while the product shows **Anmelden**.

---

# Required Environment Variables

Every PVNavigator Vercel project (Production, and Preview if used for auth
testing) must define these two variables. `NEXT_PUBLIC_*` values are inlined
at **build** time. Changing them requires a new deployment.

## `NEXT_PUBLIC_SUPABASE_URL`

Must be **only** the bare Supabase project origin. No path, no trailing API
prefix.

Correct:

```
https://<project-ref>.supabase.co
```

Incorrect:

```
https://<project-ref>.supabase.co/auth/v1
https://<project-ref>.supabase.co/rest/v1
```

The Supabase client appends `/auth/v1/...` itself. If the env value already
contains `/auth/v1` or `/rest/v1`, `getUser()` calls a doubled path and Auth
returns `404 Invalid path specified in request URL`. Middleware then treats
the user as logged out.

All applications must use the **same** origin (same project ref).

## `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The publishable / anon key of that same project.

Every PVNavigator application must use **exactly the same value**. A matching
cookie with a mismatched key or project cannot be validated.

## Optional variables

These are not required when hosts are `pvnavigator.de` /
`speicher.pvnavigator.de`. Cookie Domain is derived from the request host.

| Variable | Purpose |
|---|---|
| `AUTH_COOKIE_DOMAIN` | Optional override; if set, must be `.pvnavigator.de` |
| `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` | Optional public override; same constraint |
| `NEXT_PUBLIC_HUB_URL` | Hub origin override |
| `NEXT_PUBLIC_SITE_URL` | Hub site origin (email redirects). Set on Hub to `https://pvnavigator.de`. Do not set a product origin here. |
| `NEXT_PUBLIC_SPEICHER_GRENZE_URL` | SpeicherGrenze origin override |

Do not put a `service_role` key in any Next.js application.

---

# Deployment Checklist

Before deploying any new application, verify:

- [ ] Same Supabase project as Hub
- [ ] Same `NEXT_PUBLIC_SUPABASE_URL` (bare origin only)
- [ ] Same `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Shared cookie configuration via `@pv-auth/session` (`sb-pvnav-auth`,
      `Domain=.pvnavigator.de` in production)
- [ ] Session writes use the Hub Route Handler pipeline (or equivalent raw
      `Set-Cookie` with parent Domain). Never `cookies().set()` for a live
      session
- [ ] Protected routes redirect to Hub `/anmelden`, not a local login
- [ ] Cross-subdomain login works: Hub login → product host shows the signed-in
      account without a second prompt

After env changes, redeploy. Build-time inlining means a running deployment
will keep the old project URL until it is rebuilt.

---

# Troubleshooting

## Hub login works but another service shows “Anmelden”

The Hub session exists; the product `getUser()` returned null.

Possible causes:

1. The product’s `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   differs from Hub, or the URL contains `/auth/v1` or `/rest/v1`.
2. The session cookie is host-only on `pvnavigator.de` (`Domain` missing). The
   product host never receives it.
3. The product uses a different cookie name than `sb-pvnav-auth`.
4. A leftover host-only twin or legacy `sb-*-auth-token` is masking the
   parent-domain cookie on Hub only.

Check in DevTools: cookie name `sb-pvnav-auth`, `Domain=.pvnavigator.de`, and
that a document request to the product host includes that cookie.

## `ERR_TOO_MANY_REDIRECTS`

Typical loop:

1. Product `/calculate` (or equivalent) sees `user=false` → 307 to
   `https://pvnavigator.de/anmelden?next=…`
2. Hub `/anmelden` sees `user=true` → 307 back to the product URL
3. Repeat until the browser stops

Possible causes: the same as “Anmelden” on the product. Hub and product
disagree about the session. Do not add a handoff page to break the loop.

## `AuthApiError: Invalid path specified in request URL` (404)

This is almost always `NEXT_PUBLIC_SUPABASE_URL` with an extra path.

The client requests `{URL}/auth/v1/user`. If `URL` is already
`https://<ref>.supabase.co/auth/v1`, the path is invalid and Auth returns 404.
Middleware ignores the error and continues as logged out.

Fix: set the variable to the bare origin only, then redeploy.

---

# Lessons Learned

During implementation of shared authentication, the cookie architecture was
correct: one cookie name, `Domain=.pvnavigator.de`, Hub Route Handlers, no
host-only `cookies().set()` session writes, no continue/catch/accept bridge.

Production still failed: Hub stayed logged in, SpeicherGrenze showed
**Anmelden**, and `/calculate` entered `ERR_TOO_MANY_REDIRECTS`.

The defect was not the cookie design. One Vercel project
(`speicher-physik`) had `NEXT_PUBLIC_SUPABASE_URL` with an additional path.
`getUser()` in product middleware failed with `AuthApiError` 404 Invalid path.
The error was treated as `user=null`. Hub, configured with the bare origin,
validated the same browser cookie successfully.

**Fix:** use only the bare Supabase project origin in every Vercel project,
with the same anon / publishable key as Hub, then redeploy.

---

# Future Extensions

To add a PVNavigator application on `*.pvnavigator.de`:

1. Use the same Supabase project and the two required env vars (bare origin,
   identical key).
2. Depend on `@pv-auth/session` and `getAuthCookieOptions()` for every
   `createServerClient` / middleware client.
3. Gate protected routes with server-side `getUser()`. On failure, redirect
   to Hub `/anmelden` with an approved `next` alias registered in
   `@pv-auth/session`.
4. Do not add login forms, cookie handoff routes, or a second Auth project.

The platform goal is that every new `*.pvnavigator.de` application
participates in the shared session automatically: one account, one login, one
cookie, one Supabase project.
