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

Ohne diese Werte zeigen die Auth-Seiten (`/anmelden`, `/konto-erstellen`) einen Hinweis statt Credentials an.

**Routen:** `/konto-erstellen` (Registrierung), `/anmelden` (Login), `/konto` (geschützte Übersicht).

## Erwartete Subdomains

| Subdomain | App |
|-----------|-----|
| `pvnavigator.de` (oder `www`) | pvnavigator-web (dieses App) |
| `speicher-physik.pvnavigator.de` | speicher-physik |
| `speicher-wirtschaft.pvnavigator.de` | speicher-wirtschaft |
| `pvshadow.pvnavigator.de` | pvshadow |

## Starten

```bash
npm run dev --workspace=apps/pvnavigator-web
```
