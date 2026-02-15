# pvnavigator-web

Home/Hub-Portal für PVNavigator. Verweist auf die drei Subdienste.

## Was ist das?

Einfache Landing-Page ohne Geschäftslogik. Keine pv-core-, pvgis- oder bdew-Pakete.

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
