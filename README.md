# PVNavigator Monorepo

Monorepo für PV-Analyse und Speicher-Berechnungen.

## Architecture

- Canonical structure: docs/ARCHITECTURE.md

## Struktur

```
pvnavigator/
├── apps/
│   ├── pvnavigator-web/  # Home/Hub – Portal mit Links zu allen Diensten
│   ├── speicher-physik/   # Speicher FREE (physikalische Berechnungen)
│   ├── speicher-wirtschaft/  # Speicher Wirtschaft (Kopie, zukünftig erweitert)
│   └── pvshadow/         # PV-Shadow / Hauptseite
├── packages/
│   ├── pv-core/           # Kernberechnungen (Eigenverbrauch, etc.)
│   ├── pvgis-adapter/     # PVGIS API-Adapter
│   └── bdew-profile/      # BDEW H0 Lastprofil
├── docs/
│   └── ARCHITECTURE.md    # Single Source of Truth (подробно)
```

## Setup

```bash
npm install
```

## Как запускать

```bash
# Speicher Physik (Standard)
npm run dev --workspace=apps/speicher-physik

# Speicher Wirtschaft
npm run dev --workspace=apps/speicher-wirtschaft

# PVShadow
npm run dev --workspace=apps/pvshadow

# pvnavigator-web (Home/Hub)
npm run dev --workspace=apps/pvnavigator-web
```

Краткие команды:

```bash
npm run dev:speicher-physik
npm run dev:speicher-wirtschaft
npm run dev:pvshadow
npm run dev:pvnavigator-web
```

## Routen

- **pvnavigator-web** (Home/Hub): `/`, `/impressum`, `/datenschutz`
- **speicher-physik / speicher-wirtschaft**: `/`, `/speicher`, `/speicher/calculate`, `/speicher/result`
- **pvshadow**: `/`, `/analyse`, `/create`

---

## Single Source of Truth

**Правило:** Вся математика, физика, агрегации, парсеры и адаптеры данных — **только в `packages/`**. В `apps/` — только UI, server actions (оркестрация), валидация формы, хранение результата.

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### Как правильно импортировать

```ts
// Server action — расчёты
import { calculateEigenverbrauch } from "@pv-core/calculations";
import { createUserLoadProfile } from "@bdew-profile/loader";
import { loadPVGISHourlyProfile } from "@pvgis-adapter/core";

// Client component — данные для графика (без fs)
import { BDEW_H0_PROFILES, formatWeight } from "@bdew-profile/loader/chart";
```

### Как нельзя

```ts
// ❌ Локальные расчёты в apps
const x = loadKwh.reduce((s, _, i) => s + Math.min(pv[i], load[i]), 0);

// ❌ Локальный loader BDEW/PVGIS
import { loadBDEW } from "../data/bdewH0Profile";

// ❌ mockCalculation с формулами
import { calculateMockResult } from "../utils/mockCalculation";
```

### API пакетов

| Package | API | Verwendung |
|---------|-----|------------|
| `@pv-core/calculations` | `calculateEigenverbrauch`, `calculateBatterySimulation`, `calculateLifecycle`, `calculateMultiYearAggregation` | Server-only |
| `@pvgis-adapter/core` | `loadPVGISHourlyProduction`, `loadPVGISHourlyProfile` | Server-only (fetch) |
| `@bdew-profile/loader` | `loadBDEWProfileHourlies`, `scaleToAnnualKWh`, `createUserLoadProfile` | Server-only (fs) |
| `@bdew-profile/loader/chart` | `BDEW_H0_PROFILES`, `formatWeight` | Client (UI-Chart) |
