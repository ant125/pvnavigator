# Phase 3 — Wärmepumpe vs WPuQ 2019 HEATPUMP

## Purpose

Validate **unmodified** `createHeatPumpComponent15Min(4000)` against the 2019
usable WPuQ HEATPUMP cohort (~30 houses). Research / validation only.

Does **not** change production, `createHeatPumpComponent15Min`, or
`calculateSpeicherResult`.

## How to run

```bash
/tmp/wpuq-venv/bin/pip install -r research/wpuq/requirements.txt matplotlib
/tmp/wpuq-venv/bin/python research/wpuq/scripts/run_phase3.py
```

Requires Phase 1 `processed/inventory.json` and
`research/wpuq/raw/2019_data_15min.hdf5`.

## Outputs

`research/wpuq/results/heatpump_validation/` — CSV, JSON, plots, and
`Phase3_Waermepumpe_Benchmark.md`.
