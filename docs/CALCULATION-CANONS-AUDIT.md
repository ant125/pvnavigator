# Calculation Canons – Audit & Restoration Plan

**Date:** 2025-01-24  
**Scope:** Find and restore canon references after monorepo migration. No changes to calculation logic.

---

## 1. Search Results: Canon Files

### Existing documentation

| File | Type | Content |
|------|------|---------|
| `docs/ARCHITECTURE.md` | Architecture canon | Monorepo structure, rules, product separation |
| `ARCHITECTURE.md` (root) | Pointer | Points to docs/ARCHITECTURE.md |
| `README.md` | Overview | Single Source of Truth section, links to docs/ARCHITECTURE.md |

### Missing canon files (never created or lost)

- **No** `CANON.md`, `methodology.md`, or `docs/canon/**` files
- **No** `apps/**/canon/` folders
- **No** dedicated calculation canon docs for:
  - PVGIS (multi-year, leap-year, 8760)
  - BDEW profile
  - Battery cycles/efficiency
  - Verified result pages

### Methodology content (inline only)

- `MethodologyAccordion.tsx` (speicher-physik, speicher-wirtschaft, src/) – contains inline German methodology text (8760h, BDEW patterns, simplifications). No link to external canon.

---

## 2. Search Results: Code References to Canons

### Explicit "Canon:" or "see docs" comments

**None found.** No `// Canon: see ...` or similar patterns in TS/TSX.

### Implicit canon-related references

| File | Line | Reference | Should link to |
|------|------|-----------|----------------|
| `packages/pv-core/src/index.ts` | 2 | "verified energy calculations" | docs/canon/PV-CORE.md |
| `packages/pv-core/src/eigenverbrauch.ts` | 2, 10 | "verified", "8760h" | docs/canon/PV-CORE.md |
| `packages/pv-core/src/battery.ts` | 2, 6, 35 | "verified physics", "8760h" | docs/canon/PV-CORE.md |
| `packages/pvgis-adapter/src/index.ts` | 2, 4, 65, 77–83 | "8760h", "Leap-year: filters Feb 29" | docs/canon/PVGIS.md |
| `packages/bdew-profile/src/index.ts` | 3 | "Single source of truth for household load (8760h)" | docs/canon/BDEW.md |
| `packages/bdew-profile/src/chartData.ts` | 4 | "Derived from bdew_h0_hourly_nonleap.csv" | docs/canon/BDEW.md |
| `apps/speicher-physik/.../actions.ts` | 7, 15, 40 | verifiedResultStore, VerifiedResult | docs/canon/VERIFIED-RESULT.md |
| `apps/speicher-wirtschaft/.../actions.ts` | 7, 15, 40 | same | same |
| `apps/speicher-physik/.../MethodologyAccordion.tsx` | 6 | "methodology accordion" | docs/canon/METHODOLOGY-UI.md or /speicher/technische-details |
| `apps/speicher-physik/.../layout.tsx` | 113–116 | Link to `/speicher/technische-details` | **404 – route does not exist** |

### "verified" usage

- `packages/pv-core` – module-level comments
- `verifiedResultStore.server.ts` – stores only verified (package-based) results
- `actions.ts` – returns `verifiedResult`

### "8760" usage

- `packages/pv-core`: eigenverbrauch.ts, battery.ts
- `packages/pvgis-adapter`: index.ts (validation)
- `packages/bdew-profile`: index.ts (validation)
- `apps/speicher-physik|wirtschaft`: scenarios.ts, page.tsx, ConsumptionAccordion
- `src/app/speicher`: legacy actions (local loaders)

---

## 3. Broken / Stale References

### 1. `/speicher/technische-details` – 404

- **Where:** `apps/speicher-physik/layout.tsx`, `apps/speicher-wirtschaft/layout.tsx` (footer link)
- **Problem:** Route does not exist. No `technische-details/page.tsx`.
- **Fix:** Create `apps/speicher-physik/src/app/speicher/technische-details/page.tsx` (and speicher-wirtschaft) that renders methodology content or redirects to `docs/canon/` / external doc.

### 2. Legacy `src/app/speicher/` structure

- **Path:** `src/app/speicher/calculate/actions.ts` line 21–28
- **Reference:** `path.join(process.cwd(), "src", "app", "speicher", "data", "processed", "bdew_h0_hourly_nonleap.csv")`
- **Problem:** Duplicated BDEW loader; apps/* use `@bdew-profile/loader`. `src/` appears to be pre-monorepo legacy.
- **Note:** If `src/` is still used by a root Next.js app, paths are valid. If deprecated, consider removal in a separate PR.

### 3. Duplicated BDEW CSV

- `packages/bdew-profile/data/bdew_h0_hourly_nonleap.csv` – **canonical**
- `apps/speicher-physik/.../data/processed/` – copy
- `apps/speicher-wirtschaft/.../data/processed/` – copy
- `src/app/speicher/data/processed/` – copy

Canon: packages/bdew-profile. Apps should not duplicate; bdew-profile resolves via monorepo root.

### 4. mockCalculation.ts

- **Path:** `src/app/speicher/utils/mockCalculation.ts`
- **Status:** Legacy mock; apps/speicher-physik and speicher-wirtschaft use packages. No canon reference.
- **Recommendation:** Add comment: `// DEPRECATED: Use @pv-core/calculations. Canon: docs/canon/PV-CORE.md`

---

## 4. Proposed Canon Storage (Single Source of Truth)

### Option A: `docs/canon/` (recommended)

Central place for all calculation canons. Keeps docs together, easy to discover.

```
docs/
├── ARCHITECTURE.md          # Already exists
└── canon/
    ├── README.md            # Index of all canons
    ├── PV-CORE.md           # Eigenverbrauch, battery, 8760h model
    ├── PVGIS.md             # API, leap-year, 8760h normalization
    ├── BDEW.md              # H0 profile, scaling, chart data
    ├── VERIFIED-RESULT.md   # verifiedResultStore, result page rules
    └── METHODOLOGY-UI.md    # MethodologyAccordion content, technische-details
```

**Pros:** Single location, no package coupling, easy `rg "Canon:"` from root.  
**Cons:** Canon lives outside packages; package READMEs can still point to docs/canon/.

### Option B: Per-package CANON.md

```
packages/pv-core/CANON.md
packages/pvgis-adapter/CANON.md
packages/bdew-profile/CANON.md
docs/canon/VERIFIED-RESULT.md    # App-level
docs/canon/METHODOLOGY-UI.md    # App-level
```

**Pros:** Canon next to code.  
**Cons:** UI/verified canons are app-level; split between packages and docs.

### Recommendation: **Option A** (`docs/canon/`)

- Calculation canons → `docs/canon/*.md`
- UI/methodology canons → `docs/canon/METHODOLOGY-UI.md` + `/speicher/technische-details` page
- Each package `README.md` or file header: `// Canon: docs/canon/<NAME>.md`

---

## 5. Where Canons Should Live

| Topic | Location | Rationale |
|-------|----------|-----------|
| Eigenverbrauch formula | docs/canon/PV-CORE.md | Package implements; doc describes |
| Battery simulation | docs/canon/PV-CORE.md | Same package |
| PVGIS 8760, leap-year | docs/canon/PVGIS.md | pvgis-adapter implements |
| BDEW H0 profile | docs/canon/BDEW.md | bdew-profile implements |
| Verified result flow | docs/canon/VERIFIED-RESULT.md | App-level orchestration |
| Methodology UI text | docs/canon/METHODOLOGY-UI.md | MethodologyAccordion + technische-details page |

---

## 6. Minimal PR Plan (No Calculation Logic Changes)

### Step 1: Create `docs/canon/` structure

```bash
mkdir -p docs/canon
```

### Step 2: Create canon files (content only, no code changes)

- `docs/canon/README.md` – index with links to PV-CORE, PVGIS, BDEW, VERIFIED-RESULT, METHODOLOGY-UI
- `docs/canon/PV-CORE.md` – 8760h model, eigenverbrauch formula, battery simulation rules
- `docs/canon/PVGIS.md` – API usage, leap-year handling (8784→8760), 2018 reference year
- `docs/canon/BDEW.md` – H0 profile, scaling, non-leap CSV, chart data derivation
- `docs/canon/VERIFIED-RESULT.md` – verifiedResultStore, package-only results
- `docs/canon/METHODOLOGY-UI.md` – MethodologyAccordion sections, technische-details content

### Step 3: Create `/speicher/technische-details` page

- `apps/speicher-physik/src/app/speicher/technische-details/page.tsx`
- `apps/speicher-wirtschaft/src/app/speicher/technische-details/page.tsx`
- Content: render methodology from METHODOLOGY-UI.md or inline; link to `docs/canon/` in README

### Step 4: Add `// Canon: see docs/canon/...` to source files

| File | Add |
|------|-----|
| `packages/pv-core/src/index.ts` | `// Canon: docs/canon/PV-CORE.md` |
| `packages/pv-core/src/eigenverbrauch.ts` | `// Canon: docs/canon/PV-CORE.md` |
| `packages/pv-core/src/battery.ts` | `// Canon: docs/canon/PV-CORE.md` |
| `packages/pvgis-adapter/src/index.ts` | `// Canon: docs/canon/PVGIS.md` |
| `packages/bdew-profile/src/index.ts` | `// Canon: docs/canon/BDEW.md` |
| `packages/bdew-profile/src/chartData.ts` | `// Canon: docs/canon/BDEW.md` |
| `apps/speicher-physik/.../actions.ts` | `// Canon: docs/canon/VERIFIED-RESULT.md` |
| `apps/speicher-wirtschaft/.../actions.ts` | `// Canon: docs/canon/VERIFIED-RESULT.md` |
| `apps/speicher-physik/.../MethodologyAccordion.tsx` | `// Canon: docs/canon/METHODOLOGY-UI.md` |
| `apps/speicher-wirtschaft/.../MethodologyAccordion.tsx` | `// Canon: docs/canon/METHODOLOGY-UI.md` |

### Step 5: Update docs/ARCHITECTURE.md

Add section:

```markdown
## Calculation Canons

Detailed methodology and formulas: docs/canon/
```

### Step 6: Verify no broken links

```bash
rg "Canon:" --type-add 'src:*.{ts,tsx}' -t src apps packages
# All paths must exist: docs/canon/*.md
```

### Step 7: Verify technische-details route

```bash
# After creating page
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/speicher/technische-details
# Expect 200
```

### Step 8: (Optional) Add deprecation note to mockCalculation

```ts
/**
 * DEPRECATED: Use @pv-core/calculations. Canon: docs/canon/PV-CORE.md
 * ...
 */
```

### Step 9: Update root README

In "Single Source of Truth" section, add:

```markdown
Calculation canons: [docs/canon/](docs/canon/)
```

### Step 10: Final check

```bash
rg "Canon:" apps packages
# Ensure each referenced path exists
ls docs/canon/
# PV-CORE.md PVGIS.md BDEW.md VERIFIED-RESULT.md METHODOLOGY-UI.md README.md
```

---

## 7. Summary

| Item | Status |
|------|--------|
| Dedicated calculation canon .md files | **Missing** – need to create |
| Explicit `// Canon:` comments in code | **None** – need to add |
| `/speicher/technische-details` route | **404** – need to create page |
| docs/ARCHITECTURE.md | Exists; add canon section |
| Legacy src/, mockCalculation | Document; optional deprecation |
| BDEW CSV duplication | packages/bdew-profile is canonical |

**Next action:** Create `docs/canon/` files and add `// Canon:` comments per steps 1–10 above.
