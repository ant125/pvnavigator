#!/usr/bin/env python3
"""Read-only inspection of the local ThermBuild measurement zips.

Reads zip members under research/thermbuild/raw/ in memory.
Does not extract, convert, gap-fill, or write back to raw/.
Does not build representative profiles.

Writes derived inspection artefacts only:
  research/thermbuild/results/inspection_summary.json
  research/thermbuild/results/*.png
"""

from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
RAW_DIR = ROOT / "raw"
RESULTS_DIR = ROOT / "results"

MEASURE_ZIP = "ThermBuild_measure_raw.zip"
TEMP_ZIP = "ThermBuild_measure_Temp_raw.zip"
INTERVAL_HOURS = 0.25
CAMPAIGN_START = datetime(2025, 2, 7, 0, 0, tzinfo=timezone.utc)

# Paper: 7 Feb 2025 – 30 Apr 2026. TIME in files is an integer 15-min index
# (increments by 1 per row), not hours, despite Table 3 listing unit "h".
FILENAME_RE = re.compile(
    r"age(?P<age>\d+)_Use(?P<use>\d+)_setB(?P<setB>\d+)_mass(?P<mass>\w+)"
    r"_size(?P<size>\d+)_SoProt(?P<soprot>\d+)_roo(?P<roo>\d+)"
    r"_BSE(?P<bse>\d+)_vent(?P<vent>\d+)(?:_(?P<acr>\d+))?"
    r"_rot(?P<rot>\d+)_wet(?P<wet>\w+)_(?P<kind>\w+)\.csv$"
)

AGE_MAP = {"1": "2020 / GEG-refurbished TwinHouse (paper age1*)"}
MASS_MAP = {"hea": "heavy", "mid": "middle", "lig": "light"}
BSE_MAP = {
    "1": {
        "id": "BSE1",
        "twinhouse": "O5 (western)",
        "product": "iDM iPump compact",
        "hydraulics": "direct-coupled; 50 L defrost buffer; no DHW",
    },
    "2": {
        "id": "BSE2",
        "twinhouse": "N2 (eastern)",
        "product": "iDM ALM wall-mounted indoor unit",
        "hydraulics": "storage-coupled; 825 L DHW + 500 L heating buffer + ~6 m2 solar thermal",
    },
}

CHANNEL_DOMAINS = {
    "time": ("TIME", "consecutive_days", "day_of_the_year"),
    "dhw": (
        "dhw_tap_Vset",
        "dhw_Tflow_store_tap",
        "dhw_thP_store_tap",
        "dhw_Tstore_bott",
        "dhw_Tstore_mid",
        "dhw_Tstore_top",
    ),
    "distribution": (
        "dist_Tflow_store_ufh",
        "dist_Tflow_ufh_store",
        "dist_thP",
        "dist_Tstore_bott",
        "dist_Tstore_mid",
        "dist_Tstore_top",
        "dist_Vol",
    ),
    "heat_pump": (
        "hp_elP",
        "hp_rps",
        "hp_Tflow_hp_store",
        "hp_Tflow_store_hp",
        "hp_thP",
        "hp_Vol",
        "mode_cool",
        "mode_dhw",
        "mode_heat",
    ),
    "solar": ("solar_Tflow_coll_store", "solar_Tflow_store_coll", "solar_thP"),
    "weather": (
        "wea_IbeamHor",
        "wea_IdiffHor",
        "wea_PercentrH",
        "wea_Tair_out",
        "wea_vWind",
        "wea_Wdir",
    ),
}

ROOM_STEMS = (
    "room_1_child1",
    "room_2_child2",
    "room_3_sleep",
    "room_4_bath",
    "room_5_living",
    "room_6_dining",
    "room_7_kitchen",
)
ROOM_VARS = ("ihs", "rh", "Tair", "Tret", "Tset", "valve", "win")


def parse_filename(name: str) -> dict:
    m = FILENAME_RE.match(name)
    if not m:
        raise ValueError(f"unrecognised filename: {name}")
    d = m.groupdict()
    bse = BSE_MAP[d["bse"]]
    return {
        "filename": name,
        "age_id": d["age"],
        "age": AGE_MAP.get(d["age"], d["age"]),
        "occupancy_profile": int(d["use"]),
        "night_setback": d["setB"] == "1",
        "thermal_mass": MASS_MAP.get(d["mass"], d["mass"]),
        "size_pct": int(d["size"]),
        "floor_area_m2": 140.0 * int(d["size"]) / 100.0,
        "solar_protection_glazing": d["soprot"] == "1",
        "room_code": int(d["roo"]),
        "n_common_rooms": {3: 7, 2: 6, 1: 5}[int(d["roo"])],
        "bse": bse["id"],
        "twinhouse": bse["twinhouse"],
        "hp_product": bse["product"],
        "hydraulics": bse["hydraulics"],
        "ventilation": "mechanical" if d["vent"] == "1" else "natural",
        "ventilation_acr_m3h": int(d["acr"]) if d["acr"] else None,
        "orientation_deg": int(d["rot"]),
        "weather": d["wet"],
        "kind": d["kind"],
        "heat_pump_technology": "Luft/Wasser (air-source)",
        "source": "filename encoding + Raisch et al. arXiv:2606.01994",
    }


def load_csv_from_zip(zpath: Path, member: str) -> tuple[list[str], np.ndarray]:
    with zipfile.ZipFile(zpath) as z, z.open(member) as fh:
        text = io.TextIOWrapper(fh, encoding="utf-8", newline="")
        reader = csv.reader(text)
        header = [c.strip() for c in next(reader)]
        rows = []
        for row in reader:
            if not row or all(not c.strip() for c in row):
                continue
            if len(row) != len(header):
                raise ValueError(
                    f"{member}: row width {len(row)} != header {len(header)}"
                )
            rows.append(row)
    arr = np.empty((len(rows), len(header)), dtype=np.float64)
    for i, row in enumerate(rows):
        for j, cell in enumerate(row):
            s = cell.strip()
            if s == "" or s.upper() == "NAN":
                arr[i, j] = np.nan
            else:
                arr[i, j] = float(s)
    return header, arr


def col(header: list[str], data: np.ndarray, name: str) -> np.ndarray:
    return data[:, header.index(name)]


def finite_share(x: np.ndarray) -> float:
    if x.size == 0:
        return float("nan")
    return float(np.isfinite(x).mean() * 100.0)


def nansum(x: np.ndarray) -> float:
    return float(np.nansum(x))


def month_labels_from_start(n: int) -> np.ndarray:
    """Month index 0-11 for each 15-min row, from CAMPAIGN_START + TIME*15min."""
    # Use TIME values if provided later; here sequential from row 0.
    starts = np.array(
        [
            (CAMPAIGN_START + timedelta(minutes=15 * i)).month - 1
            for i in range(n)
        ],
        dtype=np.int16,
    )
    return starts


def stats_1d(x: np.ndarray) -> dict:
    f = x[np.isfinite(x)]
    if f.size == 0:
        return {
            "n_finite": 0,
            "availability_pct": 0.0,
            "min": None,
            "p05": None,
            "median": None,
            "mean": None,
            "p95": None,
            "max": None,
        }
    return {
        "n_finite": int(f.size),
        "availability_pct": round(float(f.size / x.size * 100.0), 3),
        "min": round(float(np.min(f)), 4),
        "p05": round(float(np.percentile(f, 5)), 4),
        "median": round(float(np.median(f)), 4),
        "mean": round(float(np.mean(f)), 4),
        "p95": round(float(np.percentile(f, 95)), 4),
        "max": round(float(np.max(f)), 4),
    }


def energy_kwh(power_kw: np.ndarray) -> float:
    return nansum(power_kw) * INTERVAL_HOURS


def inspect_building(name: str, header: list[str], data: np.ndarray) -> dict:
    meta = parse_filename(name)
    n = data.shape[0]
    time = col(header, data, "TIME")
    days = col(header, data, "consecutive_days")
    doy = col(header, data, "day_of_the_year")

    time_diffs = np.diff(time)
    unique_steps = sorted({round(float(x), 6) for x in time_diffs if np.isfinite(x)})

    first_ts = CAMPAIGN_START + timedelta(minutes=15 * float(time[0]))
    last_ts = CAMPAIGN_START + timedelta(minutes=15 * float(time[-1]))
    span_days = (last_ts - first_ts).total_seconds() / 86400.0 + INTERVAL_HOURS / 24.0

    hp_el = col(header, data, "hp_elP")
    hp_th = col(header, data, "hp_thP")
    hp_rps = col(header, data, "hp_rps")
    hp_vol = col(header, data, "hp_Vol")
    t_flow = col(header, data, "hp_Tflow_hp_store")
    t_ret = col(header, data, "hp_Tflow_store_hp")
    t_out = col(header, data, "wea_Tair_out")
    dist_th = col(header, data, "dist_thP")
    dhw_th = col(header, data, "dhw_thP_store_tap")
    solar_th = col(header, data, "solar_thP")
    mode_heat = col(header, data, "mode_heat")
    mode_dhw = col(header, data, "mode_dhw")
    mode_cool = col(header, data, "mode_cool")

    cop_mask = np.isfinite(hp_el) & np.isfinite(hp_th) & (hp_el > 0.05) & (hp_th > 0.0)
    cop = np.full(n, np.nan)
    cop[cop_mask] = hp_th[cop_mask] / hp_el[cop_mask]
    seasonal_cop = None
    if np.any(cop_mask):
        seasonal_cop = float(np.sum(hp_th[cop_mask]) / np.sum(hp_el[cop_mask]))

    # Heating-rod / aux proxy: electrical load with compressor essentially stopped.
    aux_mask = (
        np.isfinite(hp_el)
        & np.isfinite(hp_rps)
        & (hp_el > 0.5)
        & (hp_rps < 1.0)
    )
    low_cop_high_el = cop_mask & (cop < 1.0) & (hp_el > 2.0)

    # Mode flags are 15-min means of 1 s booleans; can be fractional.
    def mode_share(x: np.ndarray, thr: float = 0.5) -> dict:
        f = x[np.isfinite(x)]
        if f.size == 0:
            return {
                "availability_pct": 0.0,
                "mean": None,
                "share_gt_0": None,
                "share_ge_0_5": None,
            }
        return {
            "availability_pct": round(float(np.isfinite(x).mean() * 100.0), 3),
            "mean": round(float(np.mean(f)), 4),
            "share_gt_0": round(float(np.mean(f > 0) * 100.0), 3),
            "share_ge_0_5": round(float(np.mean(f >= thr) * 100.0), 3),
        }

    # Calendar months from inferred timestamps (TIME as 15-min index).
    months = np.array(
        [
            (CAMPAIGN_START + timedelta(minutes=15 * int(t))).month
            for t in time
        ],
        dtype=np.int16,
    )
    years = np.array(
        [
            (CAMPAIGN_START + timedelta(minutes=15 * int(t))).year
            for t in time
        ],
        dtype=np.int16,
    )
    month_energy = []
    for y in sorted(set(years.tolist())):
        for m in range(1, 13):
            mask = (years == y) & (months == m) & np.isfinite(hp_el)
            if not np.any(mask):
                continue
            month_energy.append(
                {
                    "year": int(y),
                    "month": int(m),
                    "n_intervals": int(mask.sum()),
                    "hp_el_kwh": round(float(np.sum(hp_el[mask]) * INTERVAL_HOURS), 3),
                    "hp_th_kwh": round(
                        float(np.nansum(hp_th[mask]) * INTERVAL_HOURS), 3
                    ),
                    "availability_pct": round(
                        float(np.isfinite(hp_el[mask]).mean() * 100.0)
                        if mask.size
                        else 0.0,
                        3,
                    ),
                }
            )

    # Interior consecutive_days with 96 samples are full 24 h blocks.
    # Day 1 and the last day are partial (campaign start/stop). Hour-of-day
    # uses only complete days, 4 samples per hour in TIME order.
    day_ids = days.astype(np.int32)
    complete_day_ids = [
        int(d) for d in np.unique(day_ids) if int(np.sum(day_ids == d)) == 96
    ]
    diurnal = []
    for h in range(24):
        vals = []
        for d in complete_day_ids:
            idx = np.where(day_ids == d)[0]
            chunk = hp_el[idx[h * 4 : (h + 1) * 4]]
            vals.append(chunk)
        if vals:
            stacked = np.concatenate(vals)
            f = stacked[np.isfinite(stacked)]
            mean_kw = round(float(np.mean(f)), 4) if f.size else None
        else:
            mean_kw = None
        diurnal.append(
            {
                "hour": h,
                "mean_kw": mean_kw,
                "n_complete_days": len(complete_day_ids),
            }
        )

    channels = []
    for i, cname in enumerate(header):
        x = data[:, i]
        domain = "room"
        for dom, names in CHANNEL_DOMAINS.items():
            if cname in names:
                domain = dom
                break
        channels.append(
            {
                "name": cname,
                "domain": domain,
                "availability_pct": round(finite_share(x), 3),
                "n_finite": int(np.isfinite(x).sum()),
                "n_nan": int((~np.isfinite(x)).sum()),
                **{
                    k: v
                    for k, v in stats_1d(x).items()
                    if k not in ("n_finite", "availability_pct")
                },
            }
        )

    ihs_cols = [c for c in header if c.endswith("_ihs")]
    ihs_total_w = np.nansum(
        np.stack([col(header, data, c) for c in ihs_cols], axis=0), axis=0
    )

    return {
        "meta": meta,
        "n_rows": n,
        "n_columns": len(header),
        "time": {
            "TIME_min": float(time[0]),
            "TIME_max": float(time[-1]),
            "TIME_unique_steps": unique_steps,
            "regular_15min_index": unique_steps == [1.0],
            "consecutive_days_min": float(np.nanmin(days)),
            "consecutive_days_max": float(np.nanmax(days)),
            "n_unique_consecutive_days": int(len(np.unique(days[np.isfinite(days)]))),
            "n_complete_96_sample_days": int(
                sum(
                    int(np.sum(days.astype(np.int32) == d) == 96)
                    for d in np.unique(days[np.isfinite(days)].astype(np.int32))
                )
            ),
            "first_day_n_samples": int(np.sum(days.astype(np.int32) == int(np.nanmin(days)))),
            "last_day_n_samples": int(np.sum(days.astype(np.int32) == int(np.nanmax(days)))),
            "day_of_year_first": float(doy[0]),
            "day_of_year_last": float(doy[-1]),
            "paper_campaign": "2025-02-07 to 2026-04-30 (Raisch et al.)",
            "inferred_last_calendar_date": "2026-04-26 (day_of_the_year=116, non-leap)",
            "clock_time_in_file": False,
            "timezone_in_file": False,
            "timestamp_inference": (
                "TIME is a monotonic integer 15-minute sample index (step 1), not hours "
                "and not Unix time. consecutive_days 1–444 with day_of_the_year 38→116. "
                "Interior days have 96 samples (full 24 h). First and last days are partial. "
                "No clock time or timezone column exists."
            ),
        },
        "heat_pump": {
            "technology": "Luft/Wasser (air-source, identical outdoor units)",
            "electrical_energy_kwh": round(energy_kwh(hp_el), 3),
            "thermal_energy_kwh": round(energy_kwh(hp_th), 3),
            "distribution_thermal_kwh": round(energy_kwh(dist_th), 3),
            "dhw_tap_thermal_kwh": round(energy_kwh(dhw_th), 3),
            "solar_thermal_kwh": round(energy_kwh(solar_th), 3),
            "hp_elP_kw": stats_1d(hp_el),
            "hp_thP_kw": stats_1d(hp_th),
            "hp_rps": stats_1d(hp_rps),
            "hp_Vol_kgh": stats_1d(hp_vol),
            "hp_Tflow_C": stats_1d(t_flow),
            "hp_Treturn_C": stats_1d(t_ret),
            "wea_Tair_out_C": stats_1d(t_out),
            "instantaneous_cop": stats_1d(cop),
            "seasonal_cop_energy_ratio": (
                round(seasonal_cop, 4) if seasonal_cop is not None else None
            ),
            "cop_definition": "hp_thP / hp_elP where hp_elP > 0.05 kW and hp_thP > 0",
            "no_cop_column": True,
            "no_heating_rod_column": True,
            "aux_heater_proxy": {
                "rule": "hp_elP > 0.5 kW AND hp_rps < 1/s (compressor essentially off)",
                "n_intervals": int(np.sum(aux_mask)),
                "share_pct": round(float(np.mean(aux_mask) * 100.0), 3),
                "energy_kwh": round(float(np.sum(hp_el[aux_mask]) * INTERVAL_HOURS), 3),
                "share_of_hp_el_energy_pct": round(
                    float(np.sum(hp_el[aux_mask]) / max(np.nansum(hp_el), 1e-12) * 100.0),
                    3,
                ),
            },
            "low_cop_high_el_proxy": {
                "rule": "COP < 1 AND hp_elP > 2 kW",
                "n_intervals": int(np.sum(low_cop_high_el)),
                "share_pct": round(float(np.mean(low_cop_high_el) * 100.0), 3),
                "energy_kwh": round(
                    float(np.sum(hp_el[low_cop_high_el]) * INTERVAL_HOURS), 3
                ),
            },
            "mode_heat": mode_share(mode_heat),
            "mode_dhw": mode_share(mode_dhw),
            "mode_cool": mode_share(mode_cool),
            "monthly_energy": month_energy,
            "diurnal_mean_hp_el_kw": diurnal,
        },
        "occupancy_internal_gains": {
            "note": (
                "TwinHouses are unoccupied labs. Internal heat gains are "
                "electrical simulators (Occdem profiles), not household electricity."
            ),
            "ihs_total_mean_w": round(float(np.nanmean(ihs_total_w)), 3),
            "ihs_total_energy_kwh": round(energy_kwh(ihs_total_w / 1000.0), 3),
        },
        "channels": channels,
        "household_electricity_meter": False,
        "pv": False,
        "battery": False,
        "ev": False,
        "heating_rod_channel": False,
        "cop_channel": False,
        "_arrays": {
            "hp_el": hp_el,
            "hp_th": hp_th,
            "hp_rps": hp_rps,
            "t_out": t_out,
            "cop": cop,
            "mode_heat": mode_heat,
            "mode_dhw": mode_dhw,
            "mode_cool": mode_cool,
            "time": time,
            "header": header,
            "data": data,
        },
    }


def inspect_temp(name: str, header: list[str], data: np.ndarray) -> dict:
    meta = parse_filename(name)
    time = col(header, data, "TIME")
    channels = []
    for i, cname in enumerate(header):
        x = data[:, i]
        channels.append(
            {
                "name": cname,
                "availability_pct": round(finite_share(x), 3),
                "n_finite": int(np.isfinite(x).sum()),
                "n_nan": int((~np.isfinite(x)).sum()),
                **{
                    k: v
                    for k, v in stats_1d(x).items()
                    if k not in ("n_finite", "availability_pct")
                },
            }
        )
    return {
        "meta": meta,
        "n_rows": data.shape[0],
        "n_columns": len(header),
        "TIME_min": float(time[0]),
        "TIME_max": float(time[-1]),
        "TIME_unique_steps": sorted(
            {round(float(x), 6) for x in np.diff(time) if np.isfinite(x)}
        ),
        "channels": channels,
    }


def zip_listing(path: Path) -> dict:
    with zipfile.ZipFile(path) as z:
        members = []
        for info in z.infolist():
            members.append(
                {
                    "name": info.filename,
                    "uncompressed_bytes": info.file_size,
                    "compressed_bytes": info.compress_size,
                    "date_time": list(info.date_time),
                }
            )
    return {
        "path": str(path.relative_to(ROOT.parent.parent) if False else path.name),
        "zip_bytes": path.stat().st_size,
        "members": members,
    }


def plot_overview(buildings: list[dict], out_dir: Path) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    colors = ["#1f4e79", "#c45911"]

    # 1. Daily mean electrical power
    fig, ax = plt.subplots(figsize=(11, 4.2))
    for i, b in enumerate(buildings):
        hp = b["_arrays"]["hp_el"]
        t = b["_arrays"]["time"]
        n_days = int(np.ceil(hp.size / 96))
        daily = np.array(
            [
                np.nanmean(hp[d * 96 : (d + 1) * 96])
                for d in range(n_days)
            ]
        )
        x = np.arange(n_days)
        ax.plot(
            x,
            daily,
            lw=0.9,
            color=colors[i],
            label=f"{b['meta']['bse']} {b['meta']['twinhouse']}",
        )
    ax.set_title("TwinHouse heat-pump electrical power — daily mean")
    ax.set_xlabel("Campaign day index (consecutive_days, day 1 = 2025-02-07)")
    ax.set_ylabel("Mean hp_elP (kW)")
    ax.legend(frameon=False)
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    p = out_dir / "hp_daily_mean_power.png"
    fig.savefig(p, dpi=140)
    plt.close(fig)
    written.append(p.name)

    # 2. Monthly electrical energy
    fig, ax = plt.subplots(figsize=(11, 4.2))
    labels = None
    width = 0.38
    for i, b in enumerate(buildings):
        me = b["heat_pump"]["monthly_energy"]
        labels = [f"{m['year']}-{m['month']:02d}" for m in me]
        xs = np.arange(len(me))
        ax.bar(
            xs + (i - 0.5) * width,
            [m["hp_el_kwh"] for m in me],
            width=width,
            color=colors[i],
            label=f"{b['meta']['bse']} {b['meta']['twinhouse']}",
        )
    ax.set_xticks(np.arange(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right")
    ax.set_title("Monthly heat-pump electrical energy (NaN intervals contribute 0)")
    ax.set_ylabel("hp_elP energy (kWh)")
    ax.legend(frameon=False)
    ax.grid(True, axis="y", alpha=0.25)
    fig.tight_layout()
    p = out_dir / "hp_monthly_energy.png"
    fig.savefig(p, dpi=140)
    plt.close(fig)
    written.append(p.name)

    # 3. Diurnal profile
    fig, ax = plt.subplots(figsize=(8, 4.0))
    hours = np.arange(24)
    for i, b in enumerate(buildings):
        y = [d["mean_kw"] for d in b["heat_pump"]["diurnal_mean_hp_el_kw"]]
        ax.plot(
            hours,
            y,
            marker="o",
            ms=3.5,
            color=colors[i],
            label=f"{b['meta']['bse']} {b['meta']['twinhouse']}",
        )
    ax.set_title("Mean heat-pump electrical power by hour of day (complete 96-sample days only)")
    ax.set_xlabel("Hour of day (local day blocks; no timezone column in file)")
    ax.set_ylabel("Mean hp_elP (kW)")
    ax.set_xticks(range(0, 24, 2))
    ax.legend(frameon=False)
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    p = out_dir / "hp_diurnal_profile.png"
    fig.savefig(p, dpi=140)
    plt.close(fig)
    written.append(p.name)

    # 4. Load duration
    fig, ax = plt.subplots(figsize=(8, 4.2))
    for i, b in enumerate(buildings):
        hp = b["_arrays"]["hp_el"]
        f = hp[np.isfinite(hp)]
        ordered = np.sort(f)[::-1]
        x = np.linspace(0, 100, ordered.size)
        ax.plot(
            x,
            ordered,
            color=colors[i],
            lw=1.2,
            label=f"{b['meta']['bse']} {b['meta']['twinhouse']}",
        )
    ax.set_title("Heat-pump electrical load-duration curve")
    ax.set_xlabel("Percentage of finite 15-min intervals (%)")
    ax.set_ylabel("hp_elP (kW)")
    ax.legend(frameon=False)
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    p = out_dir / "hp_load_duration.png"
    fig.savefig(p, dpi=140)
    plt.close(fig)
    written.append(p.name)

    # 5. COP vs outdoor temperature
    fig, ax = plt.subplots(figsize=(8, 4.4))
    for i, b in enumerate(buildings):
        cop = b["_arrays"]["cop"]
        t_out = b["_arrays"]["t_out"]
        mask = np.isfinite(cop) & np.isfinite(t_out) & (cop > 0) & (cop < 12)
        # hexbin per building on shared axes is messy; subsample scatter
        idx = np.where(mask)[0]
        if idx.size > 8000:
            rng = np.random.default_rng(42 + i)
            idx = rng.choice(idx, 8000, replace=False)
        ax.scatter(
            t_out[idx],
            cop[idx],
            s=4,
            alpha=0.18,
            color=colors[i],
            label=f"{b['meta']['bse']} {b['meta']['twinhouse']}",
        )
    ax.set_title("Instantaneous COP vs outdoor air temperature (subsampled)")
    ax.set_xlabel("wea_Tair_out (°C)")
    ax.set_ylabel("COP = hp_thP / hp_elP")
    ax.set_ylim(0, 10)
    ax.legend(frameon=False, markerscale=3)
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    p = out_dir / "cop_vs_outdoor_temp.png"
    fig.savefig(p, dpi=140)
    plt.close(fig)
    written.append(p.name)

    # 6. Channel availability heatmap (HP/DHW/dist/solar/weather only)
    key_cols = []
    for names in CHANNEL_DOMAINS.values():
        key_cols.extend(names)
    key_cols = [c for c in key_cols if c not in CHANNEL_DOMAINS["time"]]
    fig, ax = plt.subplots(figsize=(11, 5.5))
    mat = []
    row_labels = []
    for b in buildings:
        lookup = {c["name"]: c["availability_pct"] for c in b["channels"]}
        mat.append([lookup.get(c, np.nan) for c in key_cols])
        row_labels.append(f"{b['meta']['bse']} {b['meta']['twinhouse']}")
    im = ax.imshow(np.array(mat), aspect="auto", vmin=0, vmax=100, cmap="YlGn")
    ax.set_yticks(range(len(row_labels)))
    ax.set_yticklabels(row_labels)
    ax.set_xticks(range(len(key_cols)))
    ax.set_xticklabels(key_cols, rotation=90, fontsize=7)
    ax.set_title("Channel availability (% finite samples)")
    fig.colorbar(im, ax=ax, label="% finite")
    fig.tight_layout()
    p = out_dir / "channel_availability.png"
    fig.savefig(p, dpi=140)
    plt.close(fig)
    written.append(p.name)

    # 7. Outdoor temperature series (daily)
    fig, ax = plt.subplots(figsize=(11, 3.8))
    b = buildings[0]
    t_out = b["_arrays"]["t_out"]
    n_days = int(np.ceil(t_out.size / 96))
    daily = np.array([np.nanmean(t_out[d * 96 : (d + 1) * 96]) for d in range(n_days)])
    ax.plot(np.arange(n_days), daily, color="#2e7d32", lw=0.9)
    ax.set_title("Holzkirchen outdoor air temperature — daily mean (BSE1 weather column)")
    ax.set_xlabel("Campaign day index (96-sample blocks from first row)")
    ax.set_ylabel("wea_Tair_out (°C)")
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    p = out_dir / "outdoor_temperature_daily.png"
    fig.savefig(p, dpi=140)
    plt.close(fig)
    written.append(p.name)

    return written


def strip_arrays(b: dict) -> dict:
    out = dict(b)
    out.pop("_arrays", None)
    return out


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    measure_zip = RAW_DIR / MEASURE_ZIP
    temp_zip = RAW_DIR / TEMP_ZIP
    if not measure_zip.exists() or not temp_zip.exists():
        raise SystemExit(f"expected zips in {RAW_DIR}")

    raw_listing = sorted(p.name for p in RAW_DIR.iterdir() if p.is_file())
    buildings = []
    with zipfile.ZipFile(measure_zip) as z:
        members = sorted(z.namelist())
    for member in members:
        header, data = load_csv_from_zip(measure_zip, member)
        buildings.append(inspect_building(member, header, data))

    temp_files = []
    with zipfile.ZipFile(temp_zip) as z:
        t_members = sorted(z.namelist())
    for member in t_members:
        header, data = load_csv_from_zip(temp_zip, member)
        temp_files.append(inspect_temp(member, header, data))

    plots = plot_overview(buildings, RESULTS_DIR)

    published_but_absent = [
        {
            "file": "ThermBuild_measure_imputed.zip",
            "role": "Same TwinHouse series with kNN (k=5) gap fill",
            "published_size": "15.77 MB",
        },
        {
            "file": "ThermBuild_Sim.zip",
            "role": "958 TRNSYS simulated buildings, 3 years each",
            "published_size": "13.09 GB",
        },
        {
            "file": "0_Dataset_description.txt",
            "role": "Fordatis description file (32 B on the record page)",
            "published_size": "32 B",
        },
    ]

    summary = {
        "dataset": {
            "title": "ThermBuild: Real-world and simulated thermal data from 960 residential multi-zone buildings in Central Europe",
            "publisher": "Fraunhofer IBP / Fordatis",
            "doi": "10.24406/fordatis/445",
            "fordatis": "https://fordatis.fraunhofer.de/handle/fordatis/486",
            "paper": "https://arxiv.org/abs/2606.01994",
            "license": "CC BY-SA 4.0",
            "authors": [
                "Matthias Kersken",
                "Fabian Raisch",
                "Markus Male",
                "Benjamin Tischler",
            ],
        },
        "local_raw_files": raw_listing,
        "zip_inventory": {
            "measure_raw": zip_listing(measure_zip),
            "measure_temp_raw": zip_listing(temp_zip),
        },
        "published_but_not_in_local_raw": published_but_absent,
        "n_real_world_buildings_local": len(buildings),
        "n_simulated_buildings_local": 0,
        "n_simulated_buildings_published": 958,
        "sampling_interval": "15 minutes (TIME increments by 1 per row)",
        "buildings": [strip_arrays(b) for b in buildings],
        "room_temperature_files": temp_files,
        "plots": plots,
    }

    out_json = RESULTS_DIR / "inspection_summary.json"
    out_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"wrote {out_json}")
    for p in plots:
        print(f"wrote {RESULTS_DIR / p}")
    for b in buildings:
        m = b["meta"]
        hp = b["heat_pump"]
        print(
            f"{m['bse']} {m['twinhouse']}: rows={b['n_rows']} "
            f"el={hp['electrical_energy_kwh']} kWh "
            f"th={hp['thermal_energy_kwh']} kWh "
            f"COP={hp['seasonal_cop_energy_ratio']} "
            f"avail_el={hp['hp_elP_kw']['availability_pct']}%"
        )


if __name__ == "__main__":
    main()
