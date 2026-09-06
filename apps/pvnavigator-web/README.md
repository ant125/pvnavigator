# pvnavigator-web

Home/Hub-Portal für PVNavigator. Verweist auf die drei Subdienste.

## Was ist das?

Hub-Portal für PVNavigator mit kontobasiertem Login (Supabase Auth). Verknüpfungen zu den Subdiensten. Keine pv-core-, pvgis- oder bdew-Pakete.

## Umgebungsvariablen (Supabase)

Legen Sie für lokale Entwicklung und Deployment folgende Variablen an (z. B. `.env.local` — nicht committen):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

In Produktion (sowohl `pvnavigator.de` als auch `speicher.pvnavigator.de`) zusätzlich:

```bash
AUTH_COOKIE_DOMAIN=.pvnavigator.de
```

Optional — gleicher Wert wie `AUTH_COOKIE_DOMAIN`, falls der Browser-Client die Domain nicht aus dem Host ableiten kann:

```bash
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.pvnavigator.de
```

Optional — für korrekte Links in Bestätigungs-E-Mails bei lokaler Entwicklung oder Staging (ohne diese Variable wird `https://pvnavigator.de` für `emailRedirectTo` verwendet):

```bash
NEXT_PUBLIC_SITE_URL=https://pvnavigator.de
```

Lokal `AUTH_COOKIE_DOMAIN` **nicht** setzen. Echtes Cross-Subdomain-Session-Verhalten muss auf den echten Domains bzw. Staging geprüft werden.

SpeicherGrenze (`apps/speicher-physik`) verwendet dieselben `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `AUTH_COOKIE_DOMAIN` Werte. Kein Service-Role-Key in Clients.

Ohne Supabase-URL und Anon-Key zeigen die Auth-Seiten (`/anmelden`, `/konto-erstellen`) einen Hinweis statt Credentials an.

**Routen:** `/konto-erstellen` (Registrierung), `/anmelden` (Login), `/konto` (geschützte Übersicht).

Login von SpeicherGrenze nutzt `?next=speicher-calculate` (feste Ziel-URL). Beliebige externe `next`-Werte werden abgelehnt.

## Erwartete Subdomains

| Subdomain | App |
|-----------|-----|
| `pvnavigator.de` (oder `www`) | pvnavigator-web (dieses App) |
| `speicher.pvnavigator.de` | speicher-physik (SpeicherGrenze) |
| `speicher-wirtschaft.pvnavigator.de` | speicher-wirtschaft |
| `pvshadow.pvnavigator.de` | pvshadow |

## Starten

```bash
npm run dev --workspace=apps/pvnavigator-web
```
