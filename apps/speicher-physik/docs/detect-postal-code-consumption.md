# Detect Hausverbrauch = PLZ (historical rows)

Do **not** delete or rewrite saved calculations automatically.

A past mobile run stored `annualConsumptionKWh = 86154` with `postalCode = "86154"`. That is a valid integer, so the kernel ran and produced a physically saturated (flat) Eigenverbrauch curve. The kernel was not wrong.

Helper: `isPostalCodeAsAnnualConsumption()` in `src/app/(speicher)/utils/annualConsumption.ts`.

SQL (read-only):

```sql
SELECT id, created_at,
       input->>'postalCode' AS postal_code,
       input->>'annualConsumptionKWh' AS annual_kwh
FROM public.calculations
WHERE product_key = 'speicher_grenze'
  AND input->>'annualConsumptionKWh' = input->>'postalCode';
```

Optional extra signal (flat curve + zero export):

```sql
AND (result_snapshot->'speicherGrenz'->'average'->>'5')::numeric
    = (result_snapshot->'speicherGrenz'->'average'->>'30')::numeric
AND (result_snapshot->'speicherGrenz'->'averageGridExportKwh'->>'5')::numeric = 0;
```
