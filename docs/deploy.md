# Deployment

Vercel settings that the repository layout depends on. Each application is a
separate Vercel project inside this monorepo.

## Vercel project `speicher-physik`

> **Warning**
> Vercel project `speicher-physik`: Root Directory = `apps/speicher-physik`.
> Do not configure Output Directory manually.

| Setting | Value |
|---|---|
| Root Directory | `apps/speicher-physik` |
| Build Command | leave to Vercel / Framework Preset auto-detection — no custom workspace command |
| Output Directory | do not set manually — auto-detected |
| Static assets | `apps/speicher-physik/public` |

The repository root also contains a `public/` directory. It belongs to an
unrelated leftover Next.js skeleton and must never serve this project.

## Why

Vercel resolves static files against the Root Directory, independently of where
the build command happens to produce `.next`. If the Root Directory stays at the
monorepo root and Build Command and Output Directory are pointed at the
application by hand, the Next.js build still succeeds, but Vercel collects
`public/` from the monorepo root. Files under `apps/speicher-physik/public` then
never reach the deployment and return 404 in production while the application
itself works.

This is not hypothetical: the scene images under `/system-scene/*.png` were
missing from production for exactly this reason, with the build log reporting
`Collected static files (public/, static/, .next/static): 4.353ms` — too fast
for several megabytes of assets, because only the root skeleton's five SVGs were
collected.
