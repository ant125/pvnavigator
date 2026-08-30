#!/usr/bin/env python3
"""Phase 3 — characterize and compare WPuQ 2019 HEATPUMP vs production model.

Research / validation only. Does not modify production Wärmepumpe code.

Reads:
  processed/inventory.json
  raw/2019_data_15min.hdf5
  processed/production_hp_4000_2019.json  (from export_production_hp_profile.ts)
  phase3_config.json
  thresholds.json

Writes under results/heatpump_validation/:
  CSV, JSON, npz companion in processed/, plus inputs for plots/report.
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

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

RESULTS_DIR = ROOT / "results" / "heatpump_validation"
CONFIG_PATH = ROOT / "phase3_config.json"
INVENTORY_PATH = PROCESSED_DIR / "inventory.json"
PRODUCTION_PATH = PROCESSED_DIR / "production_hp_4000_2019.json"
HP_PROFILES_DIR = PROCESSED_DIR / "profiles_hp_2019_normalized"
ARRAYS_PATH = PROCESSED_DIR / "hp_phase3_arrays.npz"

EXPECTED_STEPS = 35040
DT_H = 0.25
DAYS = 365
STEPS_PER_DAY = 96
MONTH_DAYS = np.array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], dtype=np.int32)
SEASON_MONTHS = {
    "winter": (12, 1, 2),
    "spring": (3, 4, 5),
    "summer": (6, 7, 8),
    "autumn": (9, 10, 11),
}


def dist_stats(values: list[float] | np.ndarray) -> dict:
    arr = np.asarray(values, dtype=np.float64)
    arr = arr[np.isfinite(arr)]
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
        "std": float(arr.std(ddof=1) if arr.size > 1 else 0.0),
    }


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


def berlin_calendar(index_unix: np.ndarray, tz: ZoneInfo) -> dict[str, np.ndarray]:
    """Local calendar arrays for the shared 15-min grid."""
    months = np.empty(EXPECTED_STEPS, dtype=np.int32)
    hours = np.empty(EXPECTED_STEPS, dtype=np.int32)
    weekdays = np.empty(EXPECTED_STEPS, dtype=np.int32)  # Mon=0 … Sun=6
    doy = np.empty(EXPECTED_STEPS, dtype=np.int32)  # 0..364
    qh = np.empty(EXPECTED_STEPS, dtype=np.int32)  # 0..95 local quarter-hour of day
    ymd = np.empty(EXPECTED_STEPS, dtype=np.int32)
    for i, ts in enumerate(index_unix):
        dt = datetime.fromtimestamp(int(ts), tz=tz)
        months[i] = dt.month
        hours[i] = dt.hour
        weekdays[i] = dt.weekday()
        doy[i] = dt.timetuple().tm_yday - 1
        qh[i] = dt.hour * 4 + dt.minute // 15
        ymd[i] = dt.year * 10000 + dt.month * 100 + dt.day
    return {
        "month": months,
        "hour": hours,
        "weekday": weekdays,
        "doy": doy,
        "qh": qh,
        "ymd": ymd,
    }


def run_lengths(mask: np.ndarray) -> np.ndarray:
    """Lengths of consecutive True runs."""
    if mask.size == 0:
        return np.array([], dtype=np.int32)
    padded = np.concatenate(([False], mask.astype(bool), [False]))
    d = np.diff(padded.astype(np.int8))
    starts = np.where(d == 1)[0]
    ends = np.where(d == -1)[0]
    return (ends - starts).astype(np.int32)


def monthly_kwh(energy: np.ndarray, months: np.ndarray, finite: np.ndarray) -> np.ndarray:
    out = np.zeros(12, dtype=np.float64)
    for m in range(1, 13):
        mask = finite & (months == m)
        out[m - 1] = float(np.nansum(energy[mask]))
    return out


def seasonal_from_monthly(monthly: np.ndarray) -> dict[str, float]:
    total = float(monthly.sum())
    denom = total if total > 0 else 1.0
    return {
        name: float(sum(monthly[m - 1] for m in ms) / denom)
        for name, ms in SEASON_MONTHS.items()
    }


def daily_kwh(energy: np.ndarray, doy: np.ndarray, finite: np.ndarray) -> np.ndarray:
    """Sum energy by local day-of-year (0..364)."""
    e = np.where(finite, energy, 0.0)
    out = np.zeros(DAYS, dtype=np.float64)
    for d in range(DAYS):
        out[d] = float(e[doy == d].sum())
    return out


def weekdays_per_doy(weekdays: np.ndarray, doy: np.ndarray) -> np.ndarray:
    out = np.zeros(DAYS, dtype=np.int32)
    for d in range(DAYS):
        w = weekdays[doy == d]
        out[d] = int(np.median(w)) if w.size else 0
    return out


def hour_energy_share(energy: np.ndarray, hours: np.ndarray, finite: np.ndarray) -> np.ndarray:
    shares = np.zeros(24, dtype=np.float64)
    total = float(np.nansum(energy[finite]))
    if total <= 0:
        return shares
    for h in range(24):
        mask = finite & (hours == h)
        shares[h] = float(np.nansum(energy[mask])) / total
    return shares


def window_share(
    energy: np.ndarray,
    hours: np.ndarray,
    finite: np.ndarray,
    start_h: int,
    end_h: int,
) -> float:
    """Energy share for local hours in [start, end) wrapping midnight if start > end."""
    if start_h < end_h:
        mask = (hours >= start_h) & (hours < end_h)
    else:
        mask = (hours >= start_h) | (hours < end_h)
    total = float(np.nansum(energy[finite]))
    if total <= 0:
        return float("nan")
    return float(np.nansum(energy[finite & mask])) / total


def weekday_weekend_daily(daily: np.ndarray, weekdays_by_day: np.ndarray) -> dict:
    wd = daily[weekdays_by_day < 5]
    we = daily[weekdays_by_day >= 5]
    wd_mean = float(wd.mean()) if wd.size else float("nan")
    we_mean = float(we.mean()) if we.size else float("nan")
    ratio = we_mean / wd_mean if wd_mean and np.isfinite(wd_mean) and wd_mean != 0 else float("nan")
    return {
        "weekday_mean_daily_kwh": wd_mean,
        "weekend_mean_daily_kwh": we_mean,
        "weekend_to_weekday_ratio": ratio,
    }


def mode_stats(power_w: np.ndarray, finite: np.ndarray, standby_w: float, rod_w: float) -> dict:
    p = power_w[finite]
    n = int(p.size)
    if n == 0:
        return {}
    standby = p < standby_w
    rod = p > rod_w
    comp = (~standby) & (~rod)
    e = p / 1000.0 * DT_H
    e_tot = float(e.sum()) if e.size else 1.0
    op = p[~standby]
    runs = run_lengths(~standby)
    return {
        "share_standby_intervals": float(standby.mean()),
        "share_compressor_intervals": float(comp.mean()),
        "share_heating_rod_intervals": float(rod.mean()),
        "share_standby_energy": float(e[standby].sum() / e_tot) if e_tot else 0.0,
        "share_compressor_energy": float(e[comp].sum() / e_tot) if e_tot else 0.0,
        "share_heating_rod_energy": float(e[rod].sum() / e_tot) if e_tot else 0.0,
        "operating_hours": float((~standby).sum() * DT_H),
        "standby_hours": float(standby.sum() * DT_H),
        "operating_interval_share": float((~standby).mean()),
        "peak_power_w": float(p.max()),
        "median_operating_power_w": float(np.median(op)) if op.size else float("nan"),
        "mean_operating_power_w": float(op.mean()) if op.size else float("nan"),
        "mean_all_power_w": float(p.mean()),
        "n_operating_runs": int(runs.size),
        "median_run_hours": float(np.median(runs) * DT_H) if runs.size else 0.0,
        "mean_run_hours": float(runs.mean() * DT_H) if runs.size else 0.0,
        "p95_run_hours": float(np.percentile(runs, 95) * DT_H) if runs.size else 0.0,
        "max_run_hours": float(runs.max() * DT_H) if runs.size else 0.0,
    }


def seasonal_mean_day(
    energy: np.ndarray,
    months: np.ndarray,
    qh: np.ndarray,
    season: str,
    finite: np.ndarray,
) -> np.ndarray:
    """Mean interval energy for each local quarter-hour slot in a season."""
    ms = SEASON_MONTHS[season]
    mask = finite & np.isin(months, ms)
    out = np.zeros(STEPS_PER_DAY, dtype=np.float64)
    for slot in range(STEPS_PER_DAY):
        m = mask & (qh == slot)
        if m.any():
            out[slot] = float(np.nanmean(energy[m]))
    return out


def profile_local_day(
    series: np.ndarray, ymd: np.ndarray, qh: np.ndarray, target: date
) -> np.ndarray:
    """Mean value per local quarter-hour slot on a calendar date (length 96)."""
    key = target.year * 10000 + target.month * 100 + target.day
    mask = ymd == key
    out = np.full(STEPS_PER_DAY, np.nan, dtype=np.float64)
    if not mask.any():
        raise RuntimeError(f"date {target.isoformat()} not found on grid")
    for slot in range(STEPS_PER_DAY):
        m = mask & (qh == slot)
        if m.any():
            out[slot] = float(np.nanmean(series[m]))
    # DST spring-forward can leave 4 empty slots; forward-fill from neighbours
    if np.any(~np.isfinite(out)):
        for slot in range(STEPS_PER_DAY):
            if not np.isfinite(out[slot]):
                left = out[slot - 1] if slot else out[slot + 1]
                right = out[slot + 1] if slot < STEPS_PER_DAY - 1 else out[slot - 1]
                fill = [v for v in (left, right) if np.isfinite(v)]
                out[slot] = float(np.mean(fill)) if fill else 0.0
    return out


def kmeans(x: np.ndarray, k: int, rng: np.random.Generator, n_init: int = 12, n_iter: int = 80):
    n = x.shape[0]
    best_labels = None
    best_cent = None
    best_inertia = np.inf
    for _ in range(n_init):
        cent = x[rng.choice(n, size=k, replace=False)].copy()
        labels = np.zeros(n, dtype=np.int32)
        for _it in range(n_iter):
            d = ((x[:, None, :] - cent[None, :, :]) ** 2).sum(axis=2)
            labels = d.argmin(axis=1).astype(np.int32)
            new_cent = cent.copy()
            for j in range(k):
                members = x[labels == j]
                if members.size:
                    new_cent[j] = members.mean(axis=0)
            if np.allclose(new_cent, cent):
                cent = new_cent
                break
            cent = new_cent
        inertia = float(((x - cent[labels]) ** 2).sum())
        if inertia < best_inertia:
            best_inertia = inertia
            best_labels = labels.copy()
            best_cent = cent.copy()
    return best_labels, best_cent, best_inertia


def classify_vs_cohort(
    prod: float, stats: dict, *, higher_is_optimistic: bool
) -> dict:
    """Position of production vs measured cohort for one metric."""
    med = stats["median"]
    p25 = stats["p25"]
    p75 = stats["p75"]
    if prod >= p25 and prod <= p75:
        band = "neutral_within_iqr"
    elif higher_is_optimistic:
        band = "optimistic" if prod > p75 else "conservative"
    else:
        band = "optimistic" if prod < p25 else "conservative"
    delta = prod - med
    rel = delta / med if med not in (0.0, 0) and np.isfinite(med) else float("nan")
    return {
        "production": prod,
        "cohort_median": med,
        "cohort_p25": p25,
        "cohort_p75": p75,
        "delta_vs_median": delta,
        "relative_delta_vs_median": rel,
        "verdict": band,
        "higher_is_optimistic": higher_is_optimistic,
    }


def round_floats(obj, nd=6):
    if isinstance(obj, dict):
        return {k: round_floats(v, nd) for k, v in obj.items()}
    if isinstance(obj, list):
        return [round_floats(v, nd) for v in obj]
    if isinstance(obj, tuple):
        return [round_floats(v, nd) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, float):
        if not np.isfinite(obj):
            return None
        return round(obj, nd)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if not np.isfinite(v) else round(v, nd)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    return obj


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    thresholds = load_thresholds()
    usable_classes = thresholds.get(
        "usable_for_benchmark_classes", ["COMPLETE", "USABLE_WITH_SMALL_GAPS"]
    )
    target = float(config["target_annual_kwh"])
    tol = float(config["normalize_tolerance_kwh"])
    standby_w = float(config["standby_max_w"])
    rod_w = float(config["heating_rod_min_w"])
    tz = ZoneInfo(config["timezone"])
    pv_lo, pv_hi = config["pv_window_hours_local"]
    night_lo, night_hi = config["night_window_hours_local"]
    rng = np.random.default_rng(int(config.get("cluster_random_seed", 42)))

    if not INVENTORY_PATH.is_file():
        print(f"Missing {INVENTORY_PATH}; run Phase 1 first.")
        return 1
    if not PRODUCTION_PATH.is_file():
        print(f"Missing {PRODUCTION_PATH}; run export_production_hp_profile.ts first.")
        return 1

    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    records = usable_hp_records(inventory, usable_classes)
    print(f"2019 usable HEATPUMP cohort: {len(records)}")
    if len(records) == 0:
        return 1

    prod_payload = json.loads(PRODUCTION_PATH.read_text(encoding="utf-8"))
    prod_e = np.asarray(prod_payload["interval_energy_kwh"], dtype=np.float64)
    if prod_e.shape[0] != EXPECTED_STEPS:
        raise RuntimeError(f"production profile length {prod_e.shape[0]}")
    prod_sum = float(prod_e.sum())
    if abs(prod_sum - target) > tol:
        raise RuntimeError(f"production sum {prod_sum} != {target}")
    prod_p = prod_e / DT_H * 1000.0

    raw_path = RAW_DIR / "2019_data_15min.hdf5"
    house_ids: list[str] = []
    pv_groups: list[str] = []
    completeness: list[str] = []
    raw_energy = np.zeros((len(records), EXPECTED_STEPS), dtype=np.float64)
    raw_power = np.zeros((len(records), EXPECTED_STEPS), dtype=np.float64)
    finite_all = np.zeros((len(records), EXPECTED_STEPS), dtype=bool)

    with h5py.File(raw_path, "r") as h5:
        index = None
        for i, rec in enumerate(records):
            house_id = rec["house_id"]
            pv_group = rec["pv_group"]
            path = f"{pv_group}/{house_id}/HEATPUMP/table"
            table = h5[path][:]
            power = np.asarray(table["P_TOT"], dtype=np.float64)
            if index is None:
                index = np.asarray(table["index"], dtype=np.int64)
            if power.shape[0] != EXPECTED_STEPS:
                raise RuntimeError(f"{house_id}: bad length {power.shape[0]}")
            finite = np.isfinite(power)
            energy = np.where(finite, power / 1000.0 * DT_H, np.nan)
            house_ids.append(house_id)
            pv_groups.append(pv_group)
            completeness.append(str(rec["HEATPUMP"].get("completeness_class")))
            raw_power[i] = power
            raw_energy[i] = energy
            finite_all[i] = finite
            print(
                f"  {house_id}: {float(np.nansum(energy)):.0f} kWh "
                f"avail={100.0 * finite.mean():.2f}%"
            )

    assert index is not None
    cal = berlin_calendar(index, tz)
    months, hours, weekdays, doy = cal["month"], cal["hour"], cal["weekday"], cal["doy"]
    qh, ymd = cal["qh"], cal["ymd"]
    weekdays_by_day = weekdays_per_doy(weekdays, doy)

    measured_annual = np.nansum(raw_energy, axis=1)
    scales = target / measured_annual
    norm_energy = raw_energy * scales[:, None]
    # NaN stays NaN; treat non-finite as 0 after check
    for i in range(len(house_ids)):
        s = float(np.nansum(norm_energy[i]))
        if abs(s - target) > max(tol, 1e-4):
            raise RuntimeError(f"{house_ids[i]}: normalized sum {s} != {target}")
    norm_power = norm_energy / DT_H * 1000.0
    prod_finite = np.ones(EXPECTED_STEPS, dtype=bool)

    HP_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Per-house characterization (RAW for physical modes/power; shares from energy)
    char_rows = []
    shape_rows = []
    monthly_raw = np.zeros((len(house_ids), 12), dtype=np.float64)
    monthly_norm = np.zeros((len(house_ids), 12), dtype=np.float64)
    hourly_share = np.zeros((len(house_ids), 24), dtype=np.float64)
    daily_norm = np.zeros((len(house_ids), DAYS), dtype=np.float64)
    season_day_norm = {s: np.zeros((len(house_ids), STEPS_PER_DAY)) for s in SEASON_MONTHS}

    for i, hid in enumerate(house_ids):
        fin = finite_all[i]
        e_raw = raw_energy[i]
        e_n = np.where(fin, norm_energy[i], np.nan)
        p_raw = raw_power[i]
        p_n = np.where(fin, norm_power[i], np.nan)
        monthly_raw[i] = monthly_kwh(e_raw, months, fin)
        monthly_norm[i] = monthly_kwh(e_n, months, fin)
        seas_raw = seasonal_from_monthly(monthly_raw[i])
        seas_n = seasonal_from_monthly(monthly_norm[i])
        modes_raw = mode_stats(p_raw, fin, standby_w, rod_w)
        modes_n = mode_stats(p_n, fin, standby_w, rod_w)
        daily_r = daily_kwh(e_raw, doy, fin)
        daily_n = daily_kwh(e_n, doy, fin)
        daily_norm[i] = daily_n
        ww_raw = weekday_weekend_daily(daily_r, weekdays_by_day)
        ww_n = weekday_weekend_daily(daily_n, weekdays_by_day)
        hs = hour_energy_share(e_n, hours, fin)
        hourly_share[i] = hs
        for season in SEASON_MONTHS:
            season_day_norm[season][i] = seasonal_mean_day(e_n, months, qh, season, fin)

        pv_s = window_share(e_n, hours, fin, pv_lo, pv_hi)
        night_s = window_share(e_n, hours, fin, night_lo, night_hi)

        char_rows.append(
            {
                "house_id": hid,
                "pv_group": pv_groups[i],
                "completeness_class": completeness[i],
                "availability_pct": round(100.0 * float(fin.mean()), 4),
                "annual_kwh_measured": round(float(measured_annual[i]), 3),
                "scale_to_4000": float(scales[i]),
                **{f"raw_{k}": v for k, v in modes_raw.items()},
                **{f"raw_season_{k}_share": v for k, v in seas_raw.items()},
                **{f"raw_m{m:02d}_kwh": monthly_raw[i, m - 1] for m in range(1, 13)},
                "raw_daily_kwh_mean": float(daily_r.mean()),
                "raw_daily_kwh_median": float(np.median(daily_r)),
                "raw_daily_kwh_p95": float(np.percentile(daily_r, 95)),
                "raw_daily_kwh_max": float(daily_r.max()),
                **{f"raw_{k}": v for k, v in ww_raw.items()},
            }
        )
        shape_rows.append(
            {
                "house_id": hid,
                "normalized_annual_kwh": target,
                **{f"season_{k}_share": v for k, v in seas_n.items()},
                **{f"m{m:02d}_share": monthly_norm[i, m - 1] / target for m in range(1, 13)},
                **{f"m{m:02d}_kwh": monthly_norm[i, m - 1] for m in range(1, 13)},
                "pv_window_share": pv_s,
                "night_window_share": night_s,
                "weekday_mean_daily_kwh": ww_n["weekday_mean_daily_kwh"],
                "weekend_mean_daily_kwh": ww_n["weekend_mean_daily_kwh"],
                "weekend_to_weekday_ratio": ww_n["weekend_to_weekday_ratio"],
                "peak_power_w_normalized": modes_n["peak_power_w"],
                "median_operating_power_w_normalized": modes_n["median_operating_power_w"],
                "mean_operating_power_w_normalized": modes_n["mean_operating_power_w"],
                "operating_hours_normalized": modes_n["operating_hours"],
                "operating_interval_share_normalized": modes_n["operating_interval_share"],
                "share_heating_rod_energy_normalized": modes_n["share_heating_rod_energy"],
                "daily_kwh_mean": float(daily_n.mean()),
                "daily_kwh_median": float(np.median(daily_n)),
                "daily_kwh_p95": float(np.percentile(daily_n, 95)),
                "daily_kwh_max": float(daily_n.max()),
                "hourly_share_entropy": float(
                    -np.nansum(hs[hs > 0] * np.log(hs[hs > 0]))
                ),
            }
        )

    # Production characterization on the same grid
    prod_monthly = monthly_kwh(prod_e, months, prod_finite)
    prod_seas = seasonal_from_monthly(prod_monthly)
    prod_modes = mode_stats(prod_p, prod_finite, standby_w, rod_w)
    prod_daily = daily_kwh(prod_e, doy, prod_finite)
    prod_ww = weekday_weekend_daily(prod_daily, weekdays_by_day)
    prod_hourly = hour_energy_share(prod_e, hours, prod_finite)
    prod_pv = window_share(prod_e, hours, prod_finite, pv_lo, pv_hi)
    prod_night = window_share(prod_e, hours, prod_finite, night_lo, night_hi)
    prod_season_day = {
        s: seasonal_mean_day(prod_e, months, qh, s, prod_finite) for s in SEASON_MONTHS
    }

    production_row = {
        "profile_id": "PRODUCTION_createHeatPumpComponent15Min",
        "annual_kwh": target,
        **prod_modes,
        **{f"season_{k}_share": v for k, v in prod_seas.items()},
        **{f"m{m:02d}_share": prod_monthly[m - 1] / target for m in range(1, 13)},
        **{f"m{m:02d}_kwh": float(prod_monthly[m - 1]) for m in range(1, 13)},
        "pv_window_share": prod_pv,
        "night_window_share": prod_night,
        **prod_ww,
        "daily_kwh_mean": float(prod_daily.mean()),
        "daily_kwh_median": float(np.median(prod_daily)),
        "daily_kwh_p95": float(np.percentile(prod_daily, 95)),
        "daily_kwh_max": float(prod_daily.max()),
        "hourly_share_entropy": float(
            -np.nansum(prod_hourly[prod_hourly > 0] * np.log(prod_hourly[prod_hourly > 0]))
        ),
        "note": "Piecewise-constant monthly weights; no cycling, no heating rod, no diurnal pattern.",
    }

    # Cohort distributions for every comparable shape metric
    metric_keys = [
        "season_winter_share",
        "season_spring_share",
        "season_summer_share",
        "season_autumn_share",
        *[f"m{m:02d}_share" for m in range(1, 13)],
        "pv_window_share",
        "night_window_share",
        "weekend_to_weekday_ratio",
        "weekday_mean_daily_kwh",
        "weekend_mean_daily_kwh",
        "peak_power_w_normalized",
        "median_operating_power_w_normalized",
        "mean_operating_power_w_normalized",
        "operating_hours_normalized",
        "operating_interval_share_normalized",
        "share_heating_rod_energy_normalized",
        "daily_kwh_mean",
        "daily_kwh_median",
        "daily_kwh_p95",
        "daily_kwh_max",
        "hourly_share_entropy",
    ]
    raw_metric_keys = [
        "annual_kwh_measured",
        "raw_peak_power_w",
        "raw_median_operating_power_w",
        "raw_mean_operating_power_w",
        "raw_operating_hours",
        "raw_standby_hours",
        "raw_share_standby_intervals",
        "raw_share_compressor_intervals",
        "raw_share_heating_rod_intervals",
        "raw_share_standby_energy",
        "raw_share_compressor_energy",
        "raw_share_heating_rod_energy",
        "raw_operating_interval_share",
        "raw_n_operating_runs",
        "raw_median_run_hours",
        "raw_mean_run_hours",
        "raw_season_winter_share",
        "raw_season_spring_share",
        "raw_season_summer_share",
        "raw_season_autumn_share",
        "raw_weekend_to_weekday_ratio",
    ]

    distributions = {"normalized_shape": {}, "raw_physical": {}}
    for k in metric_keys:
        distributions["normalized_shape"][k] = dist_stats([r[k] for r in shape_rows])
    for k in raw_metric_keys:
        distributions["raw_physical"][k] = dist_stats([r[k] for r in char_rows])
    for h in range(24):
        distributions["normalized_shape"][f"hour_{h:02d}_share"] = dist_stats(hourly_share[:, h])

    # Production vs cohort verdicts (shape / PV coincidence)
    prod_for_compare = {
        "season_winter_share": prod_seas["winter"],
        "season_spring_share": prod_seas["spring"],
        "season_summer_share": prod_seas["summer"],
        "season_autumn_share": prod_seas["autumn"],
        **{f"m{m:02d}_share": prod_monthly[m - 1] / target for m in range(1, 13)},
        "pv_window_share": prod_pv,
        "night_window_share": prod_night,
        "weekend_to_weekday_ratio": prod_ww["weekend_to_weekday_ratio"],
        "peak_power_w_normalized": prod_modes["peak_power_w"],
        "median_operating_power_w_normalized": prod_modes["median_operating_power_w"],
        "mean_operating_power_w_normalized": prod_modes["mean_operating_power_w"],
        "operating_hours_normalized": prod_modes["operating_hours"],
        "operating_interval_share_normalized": prod_modes["operating_interval_share"],
        "share_heating_rod_energy_normalized": prod_modes["share_heating_rod_energy"],
        "daily_kwh_p95": float(np.percentile(prod_daily, 95)),
        "daily_kwh_max": float(prod_daily.max()),
        "hourly_share_entropy": production_row["hourly_share_entropy"],
    }
    higher_opt = {
        "season_winter_share": False,  # less winter → more PV-season overlap
        "season_spring_share": True,
        "season_summer_share": True,
        "season_autumn_share": True,
        "pv_window_share": True,
        "night_window_share": False,
        "weekend_to_weekday_ratio": False,
        "peak_power_w_normalized": False,
        "median_operating_power_w_normalized": False,
        "mean_operating_power_w_normalized": False,
        "operating_hours_normalized": True,  # always-on smoother → easier PV cover
        "operating_interval_share_normalized": True,
        "share_heating_rod_energy_normalized": False,
        "daily_kwh_p95": False,
        "daily_kwh_max": False,
        "hourly_share_entropy": True,  # flatter hour-of-day is closer to uniform
    }
    for m in range(1, 13):
        # summer months higher share is optimistic; winter months lower is optimistic
        higher_opt[f"m{m:02d}_share"] = m in (4, 5, 6, 7, 8, 9)

    comparisons = {}
    for k, prod_v in prod_for_compare.items():
        st = distributions["normalized_shape"][k]
        comparisons[k] = classify_vs_cohort(
            float(prod_v), st, higher_is_optimistic=higher_opt[k]
        )

    # RMSE monthly / hourly vs each house and vs median house-shape
    med_monthly_share = np.median(monthly_norm / target, axis=0)
    mean_monthly_share = np.mean(monthly_norm / target, axis=0)
    med_hourly = np.median(hourly_share, axis=0)
    prod_monthly_share = prod_monthly / target
    rmse_monthly = np.sqrt(((monthly_norm / target - prod_monthly_share) ** 2).mean(axis=1))
    rmse_hourly = np.sqrt(((hourly_share - prod_hourly) ** 2).mean(axis=1))
    rmse_monthly_vs_median = float(
        np.sqrt(((prod_monthly_share - med_monthly_share) ** 2).mean())
    )
    rmse_hourly_vs_median = float(np.sqrt(((prod_hourly - med_hourly) ** 2).mean()))

    closest_monthly = int(rmse_monthly.argmin())
    closest_hourly = int(rmse_hourly.argmin())

    # Distance of each house to cohort median monthly shares (representative)
    dist_to_med = np.sqrt(((monthly_norm / target - med_monthly_share) ** 2).sum(axis=1))
    representative_idx = int(dist_to_med.argmin())

    # Interval-wise mean / median of normalized energy (then re-sum check)
    with np.errstate(all="ignore"):
        iw_mean = np.nanmean(norm_energy, axis=0)
        iw_median = np.nanmedian(norm_energy, axis=0)
    iw_mean = iw_mean * (target / float(np.nansum(iw_mean)))
    iw_med_sum = float(np.nansum(iw_median))
    if iw_med_sum <= 0:
        iw_median_scaled = iw_median.copy()
    else:
        iw_median_scaled = iw_median * (target / iw_med_sum)
    iw_mean_modes = mode_stats(iw_mean / DT_H * 1000.0, prod_finite, standby_w, rod_w)
    iw_med_modes = mode_stats(
        iw_median_scaled / DT_H * 1000.0, prod_finite, standby_w, rod_w
    )

    # Clustering on 12 monthly shares (normalized)
    x_month = monthly_norm / target
    clusters = {}
    for k in config["cluster_k_values"]:
        labels, cents, inertia = kmeans(x_month, int(k), rng)
        members = {}
        for j in range(int(k)):
            idx = np.where(labels == j)[0]
            members[f"cluster_{j}"] = {
                "size": int(idx.size),
                "house_ids": [house_ids[t] for t in idx.tolist()],
                "centroid_monthly_shares": cents[j].tolist(),
                "centroid_seasonal_shares": seasonal_from_monthly(cents[j] * target),
                "mean_measured_annual_kwh": float(measured_annual[idx].mean())
                if idx.size
                else None,
                "median_measured_annual_kwh": float(np.median(measured_annual[idx]))
                if idx.size
                else None,
            }
        clusters[f"k{k}"] = {
            "k": int(k),
            "inertia": inertia,
            "labels": {house_ids[i]: int(labels[i]) for i in range(len(house_ids))},
            "clusters": members,
        }

    # Correlation: measured annual kWh vs winter share (is D needed?)
    winter_shares = np.array([r["season_winter_share"] for r in shape_rows])
    if len(house_ids) > 2:
        corr_annual_winter = float(np.corrcoef(measured_annual, winter_shares)[0, 1])
        corr_annual_summer = float(
            np.corrcoef(
                measured_annual, np.array([r["season_summer_share"] for r in shape_rows])
            )[0, 1]
        )
        corr_annual_peak = float(
            np.corrcoef(measured_annual, np.array([r["raw_peak_power_w"] for r in char_rows]))[
                0, 1
            ]
        )
    else:
        corr_annual_winter = corr_annual_summer = corr_annual_peak = float("nan")

    # Load-duration / cumulative helpers stored for plots
    # Sorted descending normalized power for each house + production
    sort_power = np.sort(np.where(np.isfinite(norm_power), norm_power, 0.0), axis=1)[:, ::-1]
    prod_ldc = np.sort(prod_p)[::-1]
    sort_daily = np.sort(daily_norm, axis=1)[:, ::-1]
    prod_daily_sorted = np.sort(prod_daily)[::-1]
    # Cumulative energy vs day-of-year (calendar order)
    cum_energy = np.cumsum(np.where(np.isfinite(norm_energy), norm_energy, 0.0), axis=1)
    prod_cum = np.cumsum(prod_e)
    # Cumulative energy vs duration (Lorenz-like of interval energy, sorted desc)
    sort_e = np.sort(np.where(np.isfinite(norm_energy), norm_energy, 0.0), axis=1)[:, ::-1]
    cum_sorted_e = np.cumsum(sort_e, axis=1) / target
    prod_cum_sorted = np.cumsum(np.sort(prod_e)[::-1]) / target

    typical_slices = {}
    typical_power = {}
    typical_prod = {}
    for season, iso in config["typical_calendar_days"].items():
        y, m, d = (int(x) for x in iso.split("-"))
        cal_day = date(y, m, d)
        idx = np.where(ymd == (y * 10000 + m * 100 + d))[0]
        typical_slices[season] = {
            "date": iso,
            "n_intervals": int(idx.size),
        }
        house_day = np.zeros((len(house_ids), STEPS_PER_DAY), dtype=np.float64)
        for i in range(len(house_ids)):
            house_day[i] = profile_local_day(norm_power[i], ymd, qh, cal_day)
        typical_power[season] = house_day
        typical_prod[season] = profile_local_day(prod_p, ymd, qh, cal_day)

    # Verdict roll-up
    headline_keys = [
        "season_winter_share",
        "season_summer_share",
        "pv_window_share",
        "night_window_share",
        "peak_power_w_normalized",
        "operating_interval_share_normalized",
        "share_heating_rod_energy_normalized",
        "daily_kwh_p95",
    ]
    counts = {"optimistic": 0, "conservative": 0, "neutral_within_iqr": 0}
    for k in headline_keys:
        counts[comparisons[k]["verdict"]] += 1
    if counts["optimistic"] > counts["conservative"] and counts["optimistic"] > counts["neutral_within_iqr"]:
        overall = "optimistic"
    elif counts["conservative"] > counts["optimistic"] and counts["conservative"] > counts["neutral_within_iqr"]:
        overall = "conservative"
    elif counts["neutral_within_iqr"] >= counts["optimistic"] and counts["neutral_within_iqr"] >= counts["conservative"]:
        overall = "neutral"
    else:
        overall = "optimistic" if counts["optimistic"] >= counts["conservative"] else "conservative"

    # Architecture recommendation flags
    summer_iqr = (
        distributions["normalized_shape"]["season_summer_share"]["p75"]
        - distributions["normalized_shape"]["season_summer_share"]["p25"]
    )
    winter_iqr = (
        distributions["normalized_shape"]["season_winter_share"]["p75"]
        - distributions["normalized_shape"]["season_winter_share"]["p25"]
    )
    k2_sizes = [clusters["k2"]["clusters"][f"cluster_{j}"]["size"] for j in range(2)]
    split_is_meaningful = min(k2_sizes) >= 3 and abs(k2_sizes[0] - k2_sizes[1]) < 28

    # Write CSVs
    def write_csv(path: Path, rows: list[dict]) -> None:
        if not rows:
            return
        keys = list(rows[0].keys())
        with path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            for row in rows:
                w.writerow({k: ("" if v is None else v) for k, v in row.items()})

    write_csv(RESULTS_DIR / "house_characterization_raw.csv", round_floats(char_rows, 6))
    write_csv(RESULTS_DIR / "house_shape_normalized_4000.csv", round_floats(shape_rows, 8))

    dist_flat = []
    for group, metrics in distributions.items():
        for name, st in metrics.items():
            if not st:
                continue
            dist_flat.append({"group": group, "metric": name, **st})
    write_csv(RESULTS_DIR / "cohort_distributions.csv", round_floats(dist_flat, 8))

    cmp_flat = []
    for name, c in comparisons.items():
        cmp_flat.append({"metric": name, **c})
    write_csv(RESULTS_DIR / "production_vs_cohort.csv", round_floats(cmp_flat, 8))

    hourly_rows = []
    for h in range(24):
        st = distributions["normalized_shape"][f"hour_{h:02d}_share"]
        hourly_rows.append(
            {
                "hour_local": h,
                "production_share": float(prod_hourly[h]),
                **{f"cohort_{k}": v for k, v in st.items()},
            }
        )
    write_csv(RESULTS_DIR / "hourly_distribution.csv", round_floats(hourly_rows, 8))

    monthly_rows = []
    for m in range(1, 13):
        st = distributions["normalized_shape"][f"m{m:02d}_share"]
        monthly_rows.append(
            {
                "month": m,
                "production_kwh": float(prod_monthly[m - 1]),
                "production_share": float(prod_monthly_share[m - 1]),
                "cohort_median_kwh": float(np.median(monthly_norm[:, m - 1])),
                "cohort_mean_kwh": float(np.mean(monthly_norm[:, m - 1])),
                **{f"cohort_{k}": v for k, v in st.items()},
            }
        )
    write_csv(RESULTS_DIR / "monthly_comparison.csv", round_floats(monthly_rows, 8))

    rmse_rows = []
    for i, hid in enumerate(house_ids):
        rmse_rows.append(
            {
                "house_id": hid,
                "rmse_monthly_share_vs_production": float(rmse_monthly[i]),
                "rmse_hourly_share_vs_production": float(rmse_hourly[i]),
                "distance_to_cohort_median_monthly": float(dist_to_med[i]),
            }
        )
    write_csv(RESULTS_DIR / "shape_distance.csv", round_floats(rmse_rows, 8))

    # JSON summaries
    cohort_meta = {
        "phase": 3,
        "year": 2019,
        "research_only": True,
        "production_untouched": True,
        "usable_classes": usable_classes,
        "cohort_size": len(house_ids),
        "house_ids": house_ids,
        "pv_groups": {hid: g for hid, g in zip(house_ids, pv_groups)},
        "completeness": {hid: c for hid, c in zip(house_ids, completeness)},
        "target_annual_kwh": target,
        "timezone": config["timezone"],
        "thresholds_w": {"standby_lt": standby_w, "heating_rod_gt": rod_w},
        "pv_window_hours_local": [pv_lo, pv_hi],
        "night_window_hours_local": [night_lo, night_hi],
        "pv_window_definition": (
            f"local hours [{pv_lo}, {pv_hi}) Europe/Berlin — typical daytime PV window"
        ),
    }

    verdict = {
        "overall": overall,
        "headline_metric_counts": counts,
        "headline_metrics": {k: comparisons[k] for k in headline_keys},
        "interpretation": {
            "optimistic": (
                "Production overstates coincidence with PV and/or understates "
                "winter concentration, peaks, and heating-rod bursts relative to WPuQ."
            ),
            "conservative": (
                "Production understates PV coincidence or overstates winter/peaks "
                "relative to the measured cohort."
            ),
            "neutral": (
                "Production sits inside the cohort IQR on most headline shape metrics."
            ),
        }[overall if overall in ("optimistic", "conservative", "neutral") else "optimistic"],
        "rmse_monthly_shares_vs_cohort_median": rmse_monthly_vs_median,
        "rmse_hourly_shares_vs_cohort_median": rmse_hourly_vs_median,
        "closest_house_monthly_to_production": house_ids[closest_monthly],
        "closest_house_hourly_to_production": house_ids[closest_hourly],
        "representative_house_nearest_median_monthly": house_ids[representative_idx],
    }

    architecture = {
        "interval_wise_mean_after_renorm": {
            "operating_interval_share": iw_mean_modes["operating_interval_share"],
            "peak_power_w": iw_mean_modes["peak_power_w"],
            "median_operating_power_w": iw_mean_modes["median_operating_power_w"],
            "share_heating_rod_energy": iw_mean_modes["share_heating_rod_energy"],
            "note": (
                "Mean across asynchronously cycling houses smears compressor bursts "
                "into a smoother always-on-ish profile."
            ),
        },
        "interval_wise_median_after_renorm": {
            "operating_interval_share": iw_med_modes["operating_interval_share"],
            "peak_power_w": iw_med_modes["peak_power_w"],
            "median_operating_power_w": iw_med_modes["median_operating_power_w"],
            "share_heating_rod_energy": iw_med_modes["share_heating_rod_energy"],
            "sum_before_renorm_kwh": iw_med_sum,
            "note": (
                "Interval-wise median is often near standby when houses cycle out of phase; "
                "re-scaling then distorts peaks. Prefer a real representative house."
            ),
        },
        "production_operating_interval_share": prod_modes["operating_interval_share"],
        "correlation_measured_annual_vs_winter_share": corr_annual_winter,
        "correlation_measured_annual_vs_summer_share": corr_annual_summer,
        "correlation_measured_annual_vs_raw_peak_w": corr_annual_peak,
        "cluster_k2_sizes": k2_sizes,
        "split_appears_meaningful": bool(split_is_meaningful),
        "winter_share_iqr": winter_iqr,
        "summer_share_iqr": summer_iqr,
        "recommendation": {
            "replace_synthetic": True,
            "reason_short": (
                "The production model is piecewise-constant by month: it has no compressor "
                "cycling, no heating rod, no diurnal pattern, too little winter share and "
                "too much summer share versus the WPuQ 2019 usable HEATPUMP cohort."
            ),
            "preferred_architecture": "clustered_then_representative",
            "architectures": {
                "A_interval_wise_median": (
                    "Not recommended as a load series: asynchronous cycling collapses toward "
                    "standby; after re-normalization the shape is an artefact."
                ),
                "B_clustered_profiles": (
                    "Recommended core: k=2 (or 3) on monthly shares, then one real house "
                    "(or cluster-mean of daily duration, not interval-wise mean) per cluster, "
                    "scaled to the user annual HP kWh."
                ),
                "C_single_representative": (
                    "Acceptable default if product can only ship one series: the house nearest "
                    "the cohort median monthly-share vector, scaled to user kWh. Preserves "
                    "realistic cycling and rod events."
                ),
                "D_by_annual_kwh": (
                    "Not justified by this cohort: annual kWh vs winter/summer share "
                    "correlation is weak. Shape differences look like system/building type, "
                    "not size."
                ),
            },
            "production_migration": (
                "Keep createHeatPumpComponent15Min as a fallback; add a research-validated "
                "measured-derived 35040-step profile in a package (not apps/), registered in "
                "pv-methodology, scaled to the entered annual HP kWh. Do not average "
                "interval-wise across houses."
            ),
        },
    }

    summary = {
        **cohort_meta,
        "production_source": {
            "function": "createHeatPumpComponent15Min",
            "file": "apps/speicher-physik/src/load/heatpump.ts",
            "unmodified": True,
            "annual_kwh": target,
            "sum_kwh": prod_sum,
        },
        "distributions": distributions,
        "production": round_floats(production_row, 8),
        "comparisons": round_floats(comparisons, 8),
        "verdict": round_floats(verdict, 8),
        "clusters": round_floats(clusters, 6),
        "architecture": round_floats(architecture, 6),
        "typical_calendar_days": typical_slices,
        "representative": {
            "house_id": house_ids[representative_idx],
            "measured_annual_kwh": float(measured_annual[representative_idx]),
            "distance_to_median_monthly": float(dist_to_med[representative_idx]),
        },
        "production_note": (
            "Research only. Does not replace createHeatPumpComponent15Min "
            "or production Wärmepumpe logic."
        ),
    }
    (RESULTS_DIR / "summary.json").write_text(
        json.dumps(round_floats(summary, 8), indent=2) + "\n", encoding="utf-8"
    )

    (RESULTS_DIR / "production_profile_meta.json").write_text(
        json.dumps(
            round_floats(
                {
                    "source_function": prod_payload.get("source_function"),
                    "source_file": prod_payload.get("source_file"),
                    "unmodified": True,
                    "annual_kwh": target,
                    "sum_kwh": prod_sum,
                    "interval_count": EXPECTED_STEPS,
                    "monthly_kwh": prod_monthly.tolist(),
                    "seasonal_shares": prod_seas,
                    "hourly_energy_share": prod_hourly.tolist(),
                }
            ),
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    (RESULTS_DIR / "clusters.json").write_text(
        json.dumps(round_floats(clusters, 8), indent=2) + "\n", encoding="utf-8"
    )
    (RESULTS_DIR / "architecture_recommendation.json").write_text(
        json.dumps(round_floats(architecture, 8), indent=2) + "\n", encoding="utf-8"
    )
    (RESULTS_DIR / "verdict.json").write_text(
        json.dumps(round_floats(verdict, 8), indent=2) + "\n", encoding="utf-8"
    )

    # Arrays for plotting (gitignored npz)
    np.savez_compressed(
        ARRAYS_PATH,
        house_ids=np.array(house_ids),
        measured_annual=measured_annual,
        scales=scales,
        months=months,
        hours=hours,
        weekdays=weekdays,
        doy=doy,
        monthly_norm=monthly_norm,
        monthly_raw=monthly_raw,
        hourly_share=hourly_share,
        daily_norm=daily_norm,
        sort_power=sort_power,
        prod_ldc=prod_ldc,
        sort_daily=sort_daily,
        prod_daily=prod_daily,
        prod_daily_sorted=prod_daily_sorted,
        cum_energy=cum_energy,
        prod_cum=prod_cum,
        cum_sorted_e=cum_sorted_e,
        prod_cum_sorted=prod_cum_sorted,
        prod_e=prod_e,
        prod_p=prod_p,
        prod_hourly=prod_hourly,
        prod_monthly=prod_monthly,
        season_winter=season_day_norm["winter"],
        season_spring=season_day_norm["spring"],
        season_summer=season_day_norm["summer"],
        season_autumn=season_day_norm["autumn"],
        prod_season_winter=prod_season_day["winter"],
        prod_season_spring=prod_season_day["spring"],
        prod_season_summer=prod_season_day["summer"],
        prod_season_autumn=prod_season_day["autumn"],
        norm_power=np.where(np.isfinite(norm_power), norm_power, 0.0),
        raw_power=np.where(np.isfinite(raw_power), raw_power, 0.0),
        finite=finite_all,
        typical_winter=typical_power["winter"],
        typical_spring=typical_power["spring"],
        typical_summer=typical_power["summer"],
        typical_autumn=typical_power["autumn"],
        typical_prod_winter=typical_prod["winter"],
        typical_prod_spring=typical_prod["spring"],
        typical_prod_summer=typical_prod["summer"],
        typical_prod_autumn=typical_prod["autumn"],
        representative_idx=np.int32(representative_idx),
        closest_monthly_idx=np.int32(closest_monthly),
        weekdays_by_day=weekdays_by_day,
        ymd=ymd,
        qh=qh,
    )

    # Compact per-house normalized energy JSON is bulky; skip. npz is enough.

    print(f"Wrote {RESULTS_DIR}")
    print(f"Wrote {ARRAYS_PATH}")
    print(f"Overall verdict: {overall}")
    print(
        f"Representative (median monthly shape): {house_ids[representative_idx]}"
    )
    print(
        f"Closest monthly shape to production: {house_ids[closest_monthly]}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
