#!/usr/bin/env python3
"""Build WPuQ Phase 1 inventory and annual energy sums.

Outputs:
  research/wpuq/processed/inventory.json
  research/wpuq/processed/annual_sums.csv

HOUSEHOLD and HEATPUMP are analyzed separately. Gaps are never filled.
"""

from __future__ import annotations

import csv
import json
import sys
from calendar import isleap
from pathlib import Path

import h5py

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from wpuq_common import (  # noqa: E402
    PROCESSED_DIR,
    THRESHOLDS_PATH,
    analyze_power_series,
    expected_intervals,
    feed_exists,
    house_sort_key,
    iter_sfh_houses,
    list_raw_files,
    load_thresholds,
    read_table,
    year_from_filename,
)

FEEDS = ("HOUSEHOLD", "HEATPUMP")


def analyze_feed(
    h5: h5py.File,
    *,
    year: int,
    pv_group: str,
    house_id: str,
    feed: str,
    thresholds: dict,
) -> dict | None:
    if not feed_exists(h5, pv_group, house_id, feed):
        return None

    table = read_table(h5, pv_group, house_id, feed)
    contaminated = thresholds.get("power_column_with_pv_contamination")
    # Contaminated column only meaningful for WITH_PV HOUSEHOLD
    use_contaminated = contaminated if (pv_group == "WITH_PV" and feed == "HOUSEHOLD") else None

    stats = analyze_power_series(
        table,
        year=year,
        power_column=thresholds["power_column"],
        contaminated_column=use_contaminated,
        interval_seconds=int(thresholds["interval_seconds"]),
        energy_wh_per_watt=float(thresholds["energy_wh_per_watt_mean_interval"]),
        thresholds=thresholds,
    )

    pv_status = "not_applicable"
    if feed == "HEATPUMP":
        pv_status = "heatpump_meter_unaffected_by_rooftop_pv_self_consumption"
    elif pv_group == "NO_PV":
        pv_status = "no_rooftop_pv_self_consumption_group"
    elif pv_group == "WITH_PV":
        if stats["has_pv_contaminated_column"]:
            pv_status = (
                "with_pv_group; P_TOT is publisher-corrected estimate; "
                "P_TOT_WITH_PV is meter reading including PV (may be negative)"
            )
        else:
            pv_status = "with_pv_group_but_no_P_TOT_WITH_PV_column"

    return {
        "available": True,
        "pv_contamination_status": pv_status,
        **stats,
    }


def build_house_year(
    h5: h5py.File,
    *,
    year: int,
    source_file: str,
    pv_group: str,
    house_id: str,
    thresholds: dict,
) -> dict:
    feeds: dict[str, dict] = {}
    for feed in FEEDS:
        result = analyze_feed(
            h5,
            year=year,
            pv_group=pv_group,
            house_id=house_id,
            feed=feed,
            thresholds=thresholds,
        )
        if result is None:
            feeds[feed] = {
                "available": False,
                "completeness_class": "EXCLUDE",
                "usable_for_benchmark": False,
                "incomplete_year_flag": True,
            }
        else:
            feeds[feed] = result

    hh = feeds["HOUSEHOLD"]
    hp = feeds["HEATPUMP"]
    hh_kwh = hh.get("energy_kwh_finite_only") if hh.get("available") else None
    hp_kwh = hp.get("energy_kwh_finite_only") if hp.get("available") else None
    combined = None
    if hh_kwh is not None and hp_kwh is not None:
        combined = round(hh_kwh + hp_kwh, 3)
    elif hh_kwh is not None:
        combined = hh_kwh
    elif hp_kwh is not None:
        combined = hp_kwh

    return {
        "year": year,
        "house_id": house_id,
        "source_file": source_file,
        "pv_group": pv_group,
        "is_leap_year": isleap(year),
        "expected_intervals": expected_intervals(year),
        "pvnavigator_non_leap_grid_steps": 35040,
        "household_dataset_available": bool(hh.get("available")),
        "heatpump_dataset_available": bool(hp.get("available")),
        "HOUSEHOLD": hh,
        "HEATPUMP": hp,
        "combined_kwh_finite_only": combined,
        "notes": [
            "Annual kWh sums use only finite P_TOT samples; long gaps are not filled.",
            "2020 leap-day intervals are retained; later phases will align to PVNavigator 35040-step non-leap grid.",
        ],
    }


def annual_row(record: dict) -> dict:
    hh = record["HOUSEHOLD"]
    hp = record["HEATPUMP"]
    return {
        "year": record["year"],
        "house_id": record["house_id"],
        "pv_group": record["pv_group"],
        "is_leap_year": record["is_leap_year"],
        "household_available": record["household_dataset_available"],
        "heatpump_available": record["heatpump_dataset_available"],
        "household_kwh": hh.get("energy_kwh_finite_only"),
        "heatpump_kwh": hp.get("energy_kwh_finite_only"),
        "combined_kwh": record["combined_kwh_finite_only"],
        "household_availability_pct": hh.get("availability_pct"),
        "heatpump_availability_pct": hp.get("availability_pct"),
        "household_completeness_class": hh.get("completeness_class"),
        "heatpump_completeness_class": hp.get("completeness_class"),
        "household_usable_for_benchmark": hh.get("usable_for_benchmark"),
        "heatpump_usable_for_benchmark": hp.get("usable_for_benchmark"),
        "household_incomplete_year_flag": hh.get("incomplete_year_flag"),
        "heatpump_incomplete_year_flag": hp.get("incomplete_year_flag"),
        "household_missing_intervals": hh.get("missing_intervals"),
        "heatpump_missing_intervals": hp.get("missing_intervals"),
        "household_first_timestamp_iso_utc": hh.get("first_timestamp_iso_utc"),
        "household_last_timestamp_iso_utc": hh.get("last_timestamp_iso_utc"),
        "heatpump_first_timestamp_iso_utc": hp.get("first_timestamp_iso_utc"),
        "heatpump_last_timestamp_iso_utc": hp.get("last_timestamp_iso_utc"),
        "household_pv_contamination_status": hh.get("pv_contamination_status"),
        "heatpump_pv_contamination_status": hp.get("pv_contamination_status"),
        "household_negative_power_sample_count": hh.get("negative_power_sample_count"),
        "household_contaminated_energy_kwh": hh.get(
            "contaminated_energy_kwh_finite_only"
        ),
    }


def summarize_inventory(records: list[dict], thresholds: dict) -> dict:
    by_year: dict[int, dict] = {}
    for rec in records:
        y = rec["year"]
        bucket = by_year.setdefault(
            y,
            {
                "houses": 0,
                "household_usable": 0,
                "heatpump_usable": 0,
                "household_complete": 0,
                "heatpump_complete": 0,
                "with_pv_houses": 0,
                "no_pv_houses": 0,
            },
        )
        bucket["houses"] += 1
        if rec["pv_group"] == "WITH_PV":
            bucket["with_pv_houses"] += 1
        else:
            bucket["no_pv_houses"] += 1
        if rec["HOUSEHOLD"].get("usable_for_benchmark"):
            bucket["household_usable"] += 1
        if rec["HEATPUMP"].get("usable_for_benchmark"):
            bucket["heatpump_usable"] += 1
        if rec["HOUSEHOLD"].get("completeness_class") == "COMPLETE":
            bucket["household_complete"] += 1
        if rec["HEATPUMP"].get("completeness_class") == "COMPLETE":
            bucket["heatpump_complete"] += 1

    # Recommend 2019 NO_PV COMPLETE/USABLE houses sorted by availability then ID
    candidates = [
        rec
        for rec in records
        if rec["year"] == 2019
        and rec["pv_group"] == "NO_PV"
        and rec["HOUSEHOLD"].get("usable_for_benchmark")
    ]
    candidates.sort(
        key=lambda r: (
            -(r["HOUSEHOLD"].get("availability_pct") or 0),
            house_sort_key(r["house_id"]),
        )
    )

    return {
        "thresholds_file": str(THRESHOLDS_PATH),
        "usable_classes": thresholds.get("usable_for_benchmark_classes", []),
        "by_year": {str(k): v for k, v in sorted(by_year.items())},
        "recommended_first_benchmark_year": 2019,
        "recommended_first_benchmark_rationale": (
            "2019 is a non-leap full calendar year for most houses; "
            "2018 starts mid-year for many sites; 2020 is leap year "
            "(35136 steps vs PVNavigator 35040)."
        ),
        "recommended_household_benchmark_candidates_2019_no_pv": [
            {
                "house_id": r["house_id"],
                "availability_pct": r["HOUSEHOLD"].get("availability_pct"),
                "completeness_class": r["HOUSEHOLD"].get("completeness_class"),
                "household_kwh": r["HOUSEHOLD"].get("energy_kwh_finite_only"),
                "longest_gap_intervals": r["HOUSEHOLD"].get("longest_gap_intervals"),
            }
            for r in candidates[:15]
        ],
    }


def main() -> int:
    thresholds = load_thresholds()
    files = list_raw_files()
    if not files:
        print("No raw HDF5 files found.")
        return 1

    records: list[dict] = []
    for path in files:
        year = year_from_filename(path)
        print(f"Inventory {path.name} (year={year}) ...")
        with h5py.File(path, "r") as h5:
            for pv_group, house_id in iter_sfh_houses(h5):
                rec = build_house_year(
                    h5,
                    year=year,
                    source_file=path.name,
                    pv_group=pv_group,
                    house_id=house_id,
                    thresholds=thresholds,
                )
                records.append(rec)
        print(f"  houses={sum(1 for r in records if r['year'] == year)}")

    records.sort(key=lambda r: (r["year"], house_sort_key(r["house_id"])))
    summary = summarize_inventory(records, thresholds)

    inventory = {
        "phase": 1,
        "description": "WPuQ 15-minute inventory; research/validation only",
        "production_note": (
            "WPuQ is not production load-profile SSOT. "
            "Production continues to use BDEW H25 via packages/bdew-profile."
        ),
        "files_processed": [p.name for p in files],
        "thresholds": thresholds,
        "summary": summary,
        "house_years": records,
    }

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    inventory_path = PROCESSED_DIR / "inventory.json"
    with inventory_path.open("w", encoding="utf-8") as f:
        json.dump(inventory, f, indent=2)
        f.write("\n")
    print(f"Wrote {inventory_path}")

    csv_path = PROCESSED_DIR / "annual_sums.csv"
    rows = [annual_row(r) for r in records]
    fieldnames = list(rows[0].keys()) if rows else []
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {csv_path}")

    # Console summary
    print("\n=== Phase 1 summary ===")
    for year, stats in summary["by_year"].items():
        print(
            f"  {year}: houses={stats['houses']} "
            f"HH_usable={stats['household_usable']} "
            f"HP_usable={stats['heatpump_usable']} "
            f"HH_complete={stats['household_complete']} "
            f"NO_PV={stats['no_pv_houses']} WITH_PV={stats['with_pv_houses']}"
        )
    print(f"Best first household benchmark year: {summary['recommended_first_benchmark_year']}")
    print("Top NO_PV 2019 household candidates:")
    for c in summary["recommended_household_benchmark_candidates_2019_no_pv"][:10]:
        print(
            f"  {c['house_id']}: {c['completeness_class']} "
            f"{c['availability_pct']}%  {c['household_kwh']} kWh  "
            f"longest_gap={c['longest_gap_intervals']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
