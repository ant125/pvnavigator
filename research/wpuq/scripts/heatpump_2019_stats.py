#!/usr/bin/env python3
"""Phase 2 heat-pump statistics for 2019 usable HEATPUMP cohort (research only).

Does not feed into battery benchmark or production heat-pump model.

Outputs:
  results/heatpump_2019_statistics.csv
  results/heatpump_2019_summary.json
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
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
    load_thresholds,
)

RESULTS_DIR = ROOT / "results"
CONFIG_PATH = ROOT / "phase2_config.json"
INVENTORY_PATH = PROCESSED_DIR / "inventory.json"
EXPECTED_STEPS = 35040
DT_H = 0.25


def usable_hp_records(inventory: dict, usable_classes: list[str]) -> list[dict]:
    out = []
    for rec in inventory["house_years"]:
        if rec.get("year") != 2019:
            continue
        hp = rec.get("HEATPUMP") or {}
        if not hp.get("available"):
            continue
        if hp.get("completeness_class") not in usable_classes:
            continue
        if hp.get("row_count") != EXPECTED_STEPS:
            continue
        out.append(rec)
    out.sort(key=lambda r: house_sort_key(r["house_id"]))
    return out


def analyze_house(h5: h5py.File, rec: dict, standby_w: float, rod_w: float) -> dict:
    house_id = rec["house_id"]
    pv_group = rec["pv_group"]
    path = f"{pv_group}/{house_id}/HEATPUMP/table"
    table = h5[path][:]
    power = np.asarray(table["P_TOT"], dtype=np.float64)
    index = np.asarray(table["index"], dtype=np.int64)
    if power.shape[0] != EXPECTED_STEPS:
        raise RuntimeError(f"{house_id}: expected {EXPECTED_STEPS}, got {power.shape[0]}")

    finite = np.isfinite(power)
    avail_pct = 100.0 * float(finite.mean())
    energy = np.where(finite, power / 1000.0 * DT_H, np.nan)
    annual_kwh = float(np.nansum(energy))

    p_fin = power[finite]
    peak_w = float(np.nanmax(p_fin)) if p_fin.size else float("nan")
    nonzero = p_fin[p_fin > standby_w]
    median_op_w = float(np.median(nonzero)) if nonzero.size else float("nan")

    n = int(finite.sum())
    n_standby = int(np.sum(p_fin < standby_w))
    n_comp = int(np.sum((p_fin >= standby_w) & (p_fin <= rod_w)))
    n_rod = int(np.sum(p_fin > rod_w))

    # Monthly / seasonal from UTC month of index
    months = np.array(
        [datetime.fromtimestamp(int(ts), tz=timezone.utc).month for ts in index],
        dtype=np.int32,
    )
    monthly = {}
    for m in range(1, 13):
        mask = finite & (months == m)
        monthly[f"m{m:02d}_kwh"] = float(np.nansum(energy[mask])) if mask.any() else 0.0

    # Daily totals (96 steps)
    daily = []
    for d in range(365):
        sl = slice(d * 96, (d + 1) * 96)
        day_e = energy[sl]
        if np.all(~np.isfinite(day_e)):
            continue
        daily.append(float(np.nansum(day_e)))
    daily_arr = np.asarray(daily, dtype=np.float64) if daily else np.array([])

    winter = monthly["m12_kwh"] + monthly["m01_kwh"] + monthly["m02_kwh"]
    spring = monthly["m03_kwh"] + monthly["m04_kwh"] + monthly["m05_kwh"]
    summer = monthly["m06_kwh"] + monthly["m07_kwh"] + monthly["m08_kwh"]
    autumn = monthly["m09_kwh"] + monthly["m10_kwh"] + monthly["m11_kwh"]
    total = annual_kwh if annual_kwh > 0 else 1.0

    row = {
        "house_id": house_id,
        "pv_group": pv_group,
        "completeness_class": rec["HEATPUMP"].get("completeness_class"),
        "availability_pct": round(avail_pct, 4),
        "interval_count": EXPECTED_STEPS,
        "finite_intervals": n,
        "annual_kwh": round(annual_kwh, 3),
        "peak_15min_avg_power_w": round(peak_w, 3),
        "median_nonzero_operating_power_w": (
            round(median_op_w, 3) if np.isfinite(median_op_w) else None
        ),
        "share_standby_lt_100w": round(n_standby / n, 6) if n else None,
        "share_compressor_100w_to_4kw": round(n_comp / n, 6) if n else None,
        "share_heating_rod_gt_4kw": round(n_rod / n, 6) if n else None,
        "count_standby_lt_100w": n_standby,
        "count_compressor_100w_to_4kw": n_comp,
        "count_heating_rod_gt_4kw": n_rod,
        "season_winter_share": round(winter / total, 6),
        "season_spring_share": round(spring / total, 6),
        "season_summer_share": round(summer / total, 6),
        "season_autumn_share": round(autumn / total, 6),
        "daily_kwh_mean": round(float(daily_arr.mean()), 4) if daily_arr.size else None,
        "daily_kwh_median": round(float(np.median(daily_arr)), 4) if daily_arr.size else None,
        "daily_kwh_p95": round(float(np.percentile(daily_arr, 95)), 4)
        if daily_arr.size
        else None,
        "daily_kwh_max": round(float(daily_arr.max()), 4) if daily_arr.size else None,
        **{k: round(v, 3) for k, v in monthly.items()},
    }
    return row


def dist_stats(values: list[float]) -> dict:
    arr = np.asarray(values, dtype=np.float64)
    if arr.size == 0:
        return {}
    return {
        "count": int(arr.size),
        "min": float(arr.min()),
        "p05": float(np.percentile(arr, 5)),
        "p25": float(np.percentile(arr, 25)),
        "median": float(np.median(arr)),
        "mean": float(arr.mean()),
        "p75": float(np.percentile(arr, 75)),
        "p95": float(np.percentile(arr, 95)),
        "max": float(arr.max()),
        "std": float(arr.std(ddof=0)),
    }


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    thresholds = load_thresholds()
    usable_classes = thresholds.get(
        "usable_for_benchmark_classes", ["COMPLETE", "USABLE_WITH_SMALL_GAPS"]
    )
    hp_thr = config["heatpump_research_thresholds_w"]
    standby_w = float(hp_thr["standby_max_w"])
    rod_w = float(hp_thr["heating_rod_min_w"])

    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    records = usable_hp_records(inventory, usable_classes)
    print(f"2019 usable HEATPUMP cohort: {len(records)}")

    raw_path = RAW_DIR / "2019_data_15min.hdf5"
    rows = []
    with h5py.File(raw_path, "r") as h5:
        for rec in records:
            row = analyze_house(h5, rec, standby_w, rod_w)
            rows.append(row)
            print(
                f"  {row['house_id']}: {row['annual_kwh']:.0f} kWh "
                f"peak={row['peak_15min_avg_power_w']:.0f} W "
                f"rod_share={row['share_heating_rod_gt_4kw']}"
            )

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = RESULTS_DIR / "heatpump_2019_statistics.csv"
    if rows:
        with csv_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)

    annuals = [r["annual_kwh"] for r in rows]
    summary = {
        "phase": 2,
        "year": 2019,
        "usable_classes": usable_classes,
        "cohort_size": len(rows),
        "house_ids": [r["house_id"] for r in rows],
        "thresholds_w": {
            "standby_lt": standby_w,
            "heating_rod_gt": rod_w,
            "note": hp_thr.get("note"),
        },
        "annual_kwh_distribution": dist_stats(annuals),
        "peak_15min_avg_power_w_distribution": dist_stats(
            [r["peak_15min_avg_power_w"] for r in rows]
        ),
        "median_operating_power_w_distribution": dist_stats(
            [
                r["median_nonzero_operating_power_w"]
                for r in rows
                if r["median_nonzero_operating_power_w"] is not None
            ]
        ),
        "mean_seasonal_shares": {
            "winter": float(np.mean([r["season_winter_share"] for r in rows])),
            "spring": float(np.mean([r["season_spring_share"] for r in rows])),
            "summer": float(np.mean([r["season_summer_share"] for r in rows])),
            "autumn": float(np.mean([r["season_autumn_share"] for r in rows])),
        },
        "mean_mode_shares": {
            "standby_lt_100w": float(np.mean([r["share_standby_lt_100w"] for r in rows])),
            "compressor_100w_to_4kw": float(
                np.mean([r["share_compressor_100w_to_4kw"] for r in rows])
            ),
            "heating_rod_gt_4kw": float(
                np.mean([r["share_heating_rod_gt_4kw"] for r in rows])
            ),
        },
        "production_note": (
            "Research only. Does not replace createHeatPumpComponent15Min "
            "or production Wärmepumpe logic."
        ),
    }
    summary_path = RESULTS_DIR / "heatpump_2019_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {csv_path}")
    print(f"Wrote {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
