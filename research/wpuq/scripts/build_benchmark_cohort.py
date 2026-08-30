#!/usr/bin/env python3
"""Build 2019 NO_PV COMPLETE household cohort and extract normalized profiles.

Outputs:
  processed/benchmark_cohort_2019.json
  processed/profiles_2019_normalized/<SFHxx>.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import h5py
import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from wpuq_common import (  # noqa: E402
    PROCESSED_DIR,
    RAW_DIR,
    ROOT,
    house_sort_key,
)

CONFIG_PATH = ROOT / "phase2_config.json"
INVENTORY_PATH = PROCESSED_DIR / "inventory.json"
PROFILES_DIR = PROCESSED_DIR / "profiles_2019_normalized"
EXPECTED_STEPS = 35040
DT_H = 0.25


def load_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def select_cohort(inventory: dict) -> list[dict]:
    selected = []
    for rec in inventory["house_years"]:
        hh = rec.get("HOUSEHOLD") or {}
        if rec.get("year") != 2019:
            continue
        if rec.get("pv_group") != "NO_PV":
            continue
        if not hh.get("available"):
            continue
        if hh.get("completeness_class") != "COMPLETE":
            continue
        if hh.get("expected_intervals") != EXPECTED_STEPS:
            continue
        if hh.get("row_count") != EXPECTED_STEPS:
            continue
        if hh.get("missing_intervals", 1) != 0:
            continue
        if hh.get("nan_count", 1) != 0:
            continue
        selected.append(rec)
    selected.sort(key=lambda r: house_sort_key(r["house_id"]))
    return selected


def extract_household_kwh(h5: h5py.File, house_id: str) -> np.ndarray:
    path = f"NO_PV/{house_id}/HOUSEHOLD/table"
    if path not in h5:
        raise RuntimeError(f"Missing dataset {path}")
    table = h5[path][:]
    power_w = np.asarray(table["P_TOT"], dtype=np.float64)
    if power_w.shape[0] != EXPECTED_STEPS:
        raise RuntimeError(
            f"{house_id}: expected {EXPECTED_STEPS} rows, got {power_w.shape[0]}"
        )
    if not np.all(np.isfinite(power_w)):
        raise RuntimeError(f"{house_id}: non-finite P_TOT values present")
    if np.any(power_w < 0):
        raise RuntimeError(f"{house_id}: negative P_TOT in NO_PV cohort")
    energy_kwh = power_w / 1000.0 * DT_H
    if not np.all(np.isfinite(energy_kwh)):
        raise RuntimeError(f"{house_id}: non-finite interval energy")
    return energy_kwh


def main() -> int:
    config = load_config()
    target_kwh = float(config["annual_load_kwh"])
    tol = float(config["normalize_tolerance_kwh"])

    if not INVENTORY_PATH.is_file():
        print(f"Missing {INVENTORY_PATH}; run Phase 1 first.")
        return 1

    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    selected = select_cohort(inventory)
    print(f"Cohort candidates from inventory: {len(selected)}")

    raw_path = RAW_DIR / "2019_data_15min.hdf5"
    if not raw_path.is_file():
        print(f"Missing raw file {raw_path}")
        return 1

    PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    houses_out: list[dict] = []
    exclusions: list[dict] = []

    with h5py.File(raw_path, "r") as h5:
        for rec in selected:
            house_id = rec["house_id"]
            hh = rec["HOUSEHOLD"]
            try:
                energy = extract_household_kwh(h5, house_id)
                measured_annual = float(energy.sum())
                if measured_annual <= 0:
                    raise RuntimeError("non-positive annual energy")
                scale = target_kwh / measured_annual
                normalized = energy * scale
                norm_sum = float(normalized.sum())
                if abs(norm_sum - target_kwh) > tol:
                    raise RuntimeError(
                        f"normalize sum {norm_sum} != {target_kwh} (tol {tol})"
                    )

                profile_rel = f"processed/profiles_2019_normalized/{house_id}.json"
                profile_path = ROOT / profile_rel
                payload = {
                    "house_id": house_id,
                    "year": 2019,
                    "pv_group": "NO_PV",
                    "feed": "HOUSEHOLD",
                    "source_path": f"NO_PV/{house_id}/HOUSEHOLD/table",
                    "interval_count": EXPECTED_STEPS,
                    "timestep_hours": DT_H,
                    "original_measured_kwh": round(measured_annual, 6),
                    "target_annual_kwh": target_kwh,
                    "scale_factor": scale,
                    "normalized_sum_kwh": norm_sum,
                    "interval_energy_kwh": normalized.tolist(),
                }
                profile_path.write_text(
                    json.dumps(payload, separators=(",", ":")) + "\n",
                    encoding="utf-8",
                )

                houses_out.append(
                    {
                        "house_id": house_id,
                        "source_file": "2019_data_15min.hdf5",
                        "source_path": f"NO_PV/{house_id}/HOUSEHOLD/table",
                        "pv_group": "NO_PV",
                        "completeness_class": hh.get("completeness_class"),
                        "availability_pct": hh.get("availability_pct"),
                        "interval_count": EXPECTED_STEPS,
                        "missing_intervals": 0,
                        "original_measured_kwh": round(measured_annual, 3),
                        "normalized_annual_kwh": target_kwh,
                        "scale_factor": scale,
                        "profile_file": profile_rel,
                    }
                )
                print(
                    f"  OK {house_id}: measured={measured_annual:.1f} kWh "
                    f"scale={scale:.4f}"
                )
            except Exception as exc:  # noqa: BLE001 — research script: report & skip
                exclusions.append({"house_id": house_id, "reason": str(exc)})
                print(f"  EXCLUDE {house_id}: {exc}")

    cohort = {
        "phase": 2,
        "year": 2019,
        "selection_rules": {
            "pv_group": "NO_PV",
            "household_completeness_class": "COMPLETE",
            "interval_count": EXPECTED_STEPS,
            "missing_intervals": 0,
            "nan_count": 0,
            "no_negative_power": True,
        },
        "normalized_annual_kwh": target_kwh,
        "cohort_size": len(houses_out),
        "house_ids": [h["house_id"] for h in houses_out],
        "houses": houses_out,
        "exclusions": exclusions,
    }

    out_path = PROCESSED_DIR / "benchmark_cohort_2019.json"
    out_path.write_text(json.dumps(cohort, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {out_path}")
    print(f"Final cohort size: {len(houses_out)}")
    if exclusions:
        print(f"Exclusions during extraction: {len(exclusions)}")
    if len(houses_out) == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
