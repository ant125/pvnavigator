#!/usr/bin/env python3
"""Read-only inspection of the local OPSD household_data package.

Reads:
  research/opsd/raw/household_data_15min_singleindex.csv
  research/opsd/raw/household_data.sqlite   (schema / metadata only)

Writes (derived inspection artefacts only; raw files are never modified):
  research/opsd/results/overview.md
  research/opsd/results/*.png

Interval power and annual totals are computed in memory from cumulative kWh
meter readings. Nothing is copied, converted on disk, or written back to raw/.
"""

from __future__ import annotations

import csv
import re
import sqlite3
import sys
from calendar import isleap
from collections import defaultdict
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
RAW_DIR = ROOT / "raw"
RESULTS_DIR = ROOT / "results"

CSV_NAME = "household_data_15min_singleindex.csv"
SQLITE_NAME = "household_data.sqlite"

INTERVAL_SECONDS = 900
INTERVAL_HOURS = 0.25
COMPLETE_AVAILABILITY_PCT = 99.0
IMPLAUSIBLE_KW = 20.0  # well above typical SFH 15-min mean power

SITE_RE = re.compile(r"^DE_KN_(industrial|public|residential)(\d+)_(.+)$")

SITE_KIND = {
    "industrial1": "industrial warehouse",
    "industrial2": "industrial (crafts sector)",
    "industrial3": "industrial (research institute)",
    "public1": "school (urban)",
    "public2": "school (urban)",
    "residential1": "residential building (suburban)",
    "residential2": "residential building (suburban)",
    "residential3": "residential building (urban)",
    "residential4": "residential building (urban)",
    "residential5": "residential apartment (urban)",
    "residential6": "residential building (urban)",
}


def expected_intervals(year: int) -> int:
    return (366 if isleap(year) else 365) * 24 * 4


def fmt(n: float, digits: int = 1) -> str:
    if n is None or (isinstance(n, float) and not np.isfinite(n)):
        return "—"
    return f"{n:,.{digits}f}"


def fmt_int(n: int) -> str:
    return f"{n:,}"


def md_escape(text: str) -> str:
    return text.replace("|", "\\|")


def parse_utc(ts: str) -> np.datetime64:
    return np.datetime64(ts.replace("Z", ""), "s")


def load_csv(path: Path) -> dict:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)

    n = len(rows)
    utc = np.array([parse_utc(r[0]) for r in rows])
    cet = np.array([r[1] for r in rows])
    interpolated = np.array([r[header.index("interpolated")] for r in rows])

    numeric: dict[str, np.ndarray] = {}
    for j, name in enumerate(header):
        if name in ("utc_timestamp", "cet_cest_timestamp", "interpolated"):
            continue
        col = np.empty(n, dtype=np.float64)
        for i, row in enumerate(rows):
            val = row[j]
            col[i] = np.nan if val == "" else float(val)
        numeric[name] = col

    cet_hour = np.array([int(t[11:13]) for t in cet], dtype=np.int16)
    cet_minute = np.array([int(t[14:16]) for t in cet], dtype=np.int16)
    local_slot = cet_hour * 4 + cet_minute // 15

    return {
        "header": header,
        "n_rows": n,
        "utc": utc,
        "cet": cet,
        "interpolated": interpolated,
        "numeric": numeric,
        "local_slot": local_slot,
        "size_bytes": path.stat().st_size,
        "path": path,
    }


def sites_from_columns(columns: list[str]) -> dict[str, dict]:
    sites: dict[str, dict] = {}
    for col in columns:
        m = SITE_RE.match(col)
        if not m:
            continue
        kind, num, feed = m.group(1), m.group(2), m.group(3)
        site_id = f"{kind}{num}"
        info = sites.setdefault(
            site_id,
            {
                "id": site_id,
                "kind": kind,
                "number": int(num),
                "description": SITE_KIND.get(site_id, kind),
                "feeds": [],
                "columns": [],
            },
        )
        info["feeds"].append(feed)
        info["columns"].append(col)
    return sites


def finite_span(values: np.ndarray, utc: np.ndarray) -> dict:
    finite = np.isfinite(values)
    n_finite = int(finite.sum())
    n = values.size
    if n_finite == 0:
        return {
            "n_finite": 0,
            "n_missing": n,
            "missing_pct": 100.0,
            "first_utc": None,
            "last_utc": None,
            "first_value": None,
            "last_value": None,
            "span_kwh": None,
        }
    idx = np.flatnonzero(finite)
    first_i, last_i = int(idx[0]), int(idx[-1])
    first_v = float(values[first_i])
    last_v = float(values[last_i])
    return {
        "n_finite": n_finite,
        "n_missing": n - n_finite,
        "missing_pct": 100.0 * (n - n_finite) / n,
        "first_utc": str(utc[first_i]) + "Z",
        "last_utc": str(utc[last_i]) + "Z",
        "first_value": first_v,
        "last_value": last_v,
        "span_kwh": last_v - first_v,
    }


def interval_energy_kwh(cum: np.ndarray) -> np.ndarray:
    energy = np.full(cum.shape, np.nan, dtype=np.float64)
    energy[1:] = np.diff(cum)
    return energy


def profile_interval_stats(energy: np.ndarray) -> dict:
    finite = energy[np.isfinite(energy)]
    if finite.size == 0:
        return {
            "n_intervals": 0,
            "n_negative": 0,
            "mean_kw": None,
            "median_kw": None,
            "max_kw": None,
            "min_kw": None,
            "std_kw": None,
            "p95_kw": None,
        }
    power_kw = finite / INTERVAL_HOURS
    return {
        "n_intervals": int(finite.size),
        "n_negative": int((finite < 0).sum()),
        "mean_kw": float(np.mean(power_kw)),
        "median_kw": float(np.median(power_kw)),
        "max_kw": float(np.max(power_kw)),
        "min_kw": float(np.min(power_kw)),
        "std_kw": float(np.std(power_kw, ddof=1)) if finite.size > 1 else 0.0,
        "p95_kw": float(np.percentile(power_kw, 95)),
    }


def calendar_years(utc: np.ndarray) -> np.ndarray:
    return utc.astype("datetime64[Y]").astype(int) + 1970


def year_coverage(values: np.ndarray, utc: np.ndarray) -> list[dict]:
    years = calendar_years(utc)
    out = []
    for year in sorted(set(years.tolist())):
        mask = years == year
        col = values[mask]
        finite = np.isfinite(col)
        n_finite = int(finite.sum())
        expected = expected_intervals(int(year))
        n_in_file = int(mask.sum())
        availability = 100.0 * n_finite / expected if expected else 0.0
        complete = n_finite > 0 and availability >= COMPLETE_AVAILABILITY_PCT
        span_kwh = None
        if n_finite:
            idx = np.flatnonzero(finite)
            span_kwh = float(col[idx[-1]] - col[idx[0]])
        out.append(
            {
                "year": int(year),
                "n_rows_in_file": n_in_file,
                "n_finite": n_finite,
                "expected": expected,
                "availability_pct": availability,
                "complete": complete,
                "span_kwh": span_kwh,
            }
        )
    return out


def inspect_sqlite(path: Path, csv_header: list[str], csv_n_rows: int, csv_utc) -> dict:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    cur = con.cursor()
    master = cur.execute(
        "SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name"
    ).fetchall()
    tables = [
        row[0]
        for row in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
    ]
    table_info = {}
    for table in tables:
        cols = cur.execute(f'PRAGMA table_info("{table}")').fetchall()
        n = cur.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        first = cur.execute(
            f'SELECT utc_timestamp, cet_cest_timestamp FROM "{table}" '
            "ORDER BY utc_timestamp ASC LIMIT 1"
        ).fetchone()
        last = cur.execute(
            f'SELECT utc_timestamp, cet_cest_timestamp FROM "{table}" '
            "ORDER BY utc_timestamp DESC LIMIT 1"
        ).fetchone()
        n_interp = cur.execute(
            f'SELECT COUNT(*) FROM "{table}" '
            "WHERE interpolated IS NOT NULL AND interpolated != ''"
        ).fetchone()[0]
        n_dup = cur.execute(
            f'SELECT COUNT(*) - COUNT(DISTINCT utc_timestamp) FROM "{table}"'
        ).fetchone()[0]
        col_names = [c[1] for c in cols]
        table_info[table] = {
            "n_rows": n,
            "columns": col_names,
            "column_types": [(c[1], c[2]) for c in cols],
            "first_utc": first[0] if first else None,
            "last_utc": last[0] if last else None,
            "n_interpolated_rows": n_interp,
            "duplicate_timestamps": n_dup,
        }

    schema_sql = {
        name: sql
        for type_, name, _tbl, sql in master
        if type_ == "table" and sql
    }
    indexes = [row[1] for row in master if row[0] == "index"]
    views = [row[1] for row in master if row[0] == "view"]

    t15 = table_info.get("household_data_15min_singleindex", {})
    csv_cols = csv_header
    sqlite_cols = t15.get("columns", [])
    same_columns = csv_cols == sqlite_cols
    same_row_count = t15.get("n_rows") == csv_n_rows
    csv_first = str(csv_utc[0]) + "Z"
    csv_last = str(csv_utc[-1]) + "Z"
    same_span = t15.get("first_utc") == csv_first and t15.get("last_utc") == csv_last

    colset = set()
    for info in table_info.values():
        colset.update(info["columns"])
    joined = " ".join(sorted(colset)).lower()

    con.close()
    return {
        "size_bytes": path.stat().st_size,
        "tables": tables,
        "table_info": table_info,
        "schema_sql": schema_sql,
        "indexes": indexes,
        "views": views,
        "same_columns_as_csv": same_columns,
        "same_15min_row_count": same_row_count,
        "same_15min_time_span": same_span,
        "csv_first_utc": csv_first,
        "csv_last_utc": csv_last,
        "has_ev": any("ev" == c.split("_")[-1] or c.endswith("_ev") for c in colset)
        or any("_ev" in c for c in colset),
        "has_heat_pump": any("heat_pump" in c for c in colset),
        "has_pv": any(
            c.endswith("_pv")
            or "_pv_" in c
            or c.endswith("_pv_1")
            or c.endswith("_pv_2")
            or "pv_facade" in c
            or "pv_roof" in c
            for c in colset
        ),
        "has_battery": any("storage" in c for c in colset),
        "column_names": sorted(colset),
        "ev_columns": sorted(c for c in colset if c.endswith("_ev")),
        "heat_pump_columns": sorted(c for c in colset if "heat_pump" in c),
        "pv_columns": sorted(
            c
            for c in colset
            if c.endswith("_pv")
            or "_pv_" in c
            or c.endswith("pv_1")
            or c.endswith("pv_2")
            or "pv_facade" in c
            or "pv_roof" in c
        ),
        "battery_columns": sorted(c for c in colset if "storage" in c),
        "joined_lower": joined,
    }


def count_interpolated_columns(interpolated: np.ndarray) -> tuple[int, dict[str, int]]:
    counts: dict[str, int] = defaultdict(int)
    n_flagged = 0
    for raw in interpolated:
        if not raw:
            continue
        n_flagged += 1
        for part in raw.split("|"):
            name = part.strip()
            if name:
                counts[name] += 1
    return n_flagged, dict(counts)


def implausible_jumps(energy: np.ndarray, utc: np.ndarray) -> list[dict]:
    power = energy / INTERVAL_HOURS
    hits = np.isfinite(power) & (np.abs(power) > IMPLAUSIBLE_KW)
    out = []
    for i in np.flatnonzero(hits):
        out.append(
            {
                "utc": str(utc[int(i)]) + "Z",
                "interval_kwh": float(energy[int(i)]),
                "power_kw": float(power[int(i)]),
            }
        )
    return out


def energy_for_plot(energy: np.ndarray) -> np.ndarray:
    """Copy used only for figures: hide implausible meter jumps so other houses remain visible."""
    power = energy / INTERVAL_HOURS
    out = energy.copy()
    out[np.isfinite(power) & (np.abs(power) > IMPLAUSIBLE_KW)] = np.nan
    return out


def daily_energy(utc: np.ndarray, energy: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    valid = np.isfinite(energy)
    if not valid.any():
        return np.array([], dtype="datetime64[D]"), np.array([], dtype=np.float64)
    days = utc[valid].astype("datetime64[D]")
    unique_days, inverse = np.unique(days, return_inverse=True)
    totals = np.bincount(inverse, weights=energy[valid])
    return unique_days, totals


def mean_daily_profile(energy: np.ndarray, local_slot: np.ndarray) -> np.ndarray:
    mean_kwh = np.full(96, np.nan, dtype=np.float64)
    for slot in range(96):
        mask = (local_slot == slot) & np.isfinite(energy)
        if mask.any():
            mean_kwh[slot] = float(np.mean(energy[mask]))
    return mean_kwh


def load_duration(energy: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    finite = energy[np.isfinite(energy)]
    if finite.size == 0:
        return np.array([]), np.array([])
    power = np.sort(finite / INTERVAL_HOURS)[::-1]
    x = np.linspace(0.0, 100.0, finite.size, endpoint=True)
    return x, power


def plot_figures(
    residential_ids: list[str],
    sites: dict,
    numeric: dict,
    utc: np.ndarray,
    local_slot: np.ndarray,
    annual_complete: list[dict],
    results_dir: Path,
) -> list[str]:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError as exc:
        raise SystemExit(
            "matplotlib is required for overview figures. "
            "Use the WPuQ research venv or: pip install matplotlib"
        ) from exc

    results_dir.mkdir(parents=True, exist_ok=True)
    written = []

    fig, ax = plt.subplots(figsize=(11, 5.5))
    for site_id in residential_ids:
        col = f"DE_KN_{site_id}_grid_import"
        energy = energy_for_plot(interval_energy_kwh(numeric[col]))
        days, totals = daily_energy(utc, energy)
        if days.size == 0:
            continue
        ax.plot(days, totals, linewidth=0.9, alpha=0.85, label=site_id)
    ax.set_title(
        "Residential household load curves (daily grid-import energy)\n"
        f"intervals with |P| > {IMPLAUSIBLE_KW:.0f} kW omitted from this figure only"
    )
    ax.set_xlabel("Date (UTC)")
    ax.set_ylabel("Daily grid import (kWh/day)")
    ax.legend(ncol=3, fontsize=8)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    path = results_dir / "load_curves_all_households.png"
    fig.savefig(path, dpi=140)
    plt.close(fig)
    written.append(path.name)

    values = [row["span_kwh"] for row in annual_complete if row["span_kwh"] is not None]
    fig, ax = plt.subplots(figsize=(8, 4.8))
    if values:
        bins = max(5, min(12, len(values)))
        ax.hist(values, bins=bins, color="C0", edgecolor="white")
        ax.set_yticks(range(0, int(max(np.histogram(values, bins=bins)[0].max(), 1)) + 1))
    ax.set_title("Annual grid-import consumption (complete residential years)")
    ax.set_xlabel("Annual grid import (kWh/year)")
    ax.set_ylabel("Number of household-years")
    fig.tight_layout()
    path = results_dir / "annual_consumption_histogram.png"
    fig.savefig(path, dpi=140)
    plt.close(fig)
    written.append(path.name)

    hours = np.arange(96) / 4.0
    fig, ax = plt.subplots(figsize=(10, 5))
    for site_id in residential_ids:
        col = f"DE_KN_{site_id}_grid_import"
        energy = energy_for_plot(interval_energy_kwh(numeric[col]))
        profile = mean_daily_profile(energy, local_slot)
        ax.plot(hours, profile / INTERVAL_HOURS, linewidth=1.4, label=site_id)
    ax.set_title(
        "Average daily load profile (local CET/CEST, grid import)\n"
        f"intervals with |P| > {IMPLAUSIBLE_KW:.0f} kW omitted from this figure only"
    )
    ax.set_xlabel("Hour of day (CET/CEST)")
    ax.set_ylabel("Mean power (kW)")
    ax.set_xlim(0, 24)
    ax.set_xticks(range(0, 25, 2))
    ax.legend(ncol=3, fontsize=8)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    path = results_dir / "daily_average_load_profile.png"
    fig.savefig(path, dpi=140)
    plt.close(fig)
    written.append(path.name)

    fig, (ax_full, ax_zoom) = plt.subplots(1, 2, figsize=(12, 5.0))
    for site_id in residential_ids:
        col = f"DE_KN_{site_id}_grid_import"
        energy = interval_energy_kwh(numeric[col])
        x, power = load_duration(energy)
        if x.size == 0:
            continue
        ax_full.plot(x, power, linewidth=1.2, label=site_id)
        ax_zoom.plot(x, power, linewidth=1.2, label=site_id)
    ax_full.set_title("All intervals (raw)")
    ax_full.set_xlabel("Percent of time at or above this power")
    ax_full.set_ylabel("Power (kW)")
    ax_full.grid(True, alpha=0.3)
    ax_zoom.set_title(f"Zoom 0–{IMPLAUSIBLE_KW:.0f} kW")
    ax_zoom.set_xlabel("Percent of time at or above this power")
    ax_zoom.set_ylabel("Power (kW)")
    ax_zoom.set_ylim(0, IMPLAUSIBLE_KW)
    ax_zoom.grid(True, alpha=0.3)
    ax_zoom.legend(ncol=2, fontsize=8)
    fig.suptitle("Load duration curves (grid import)")
    fig.tight_layout()
    path = results_dir / "load_duration_curves.png"
    fig.savefig(path, dpi=140)
    plt.close(fig)
    written.append(path.name)

    return written


def write_report(
    csv_info: dict,
    sqlite_info: dict,
    sites: dict,
    year_tables: dict[str, list[dict]],
    profile_stats: dict[str, dict],
    annual_complete: list[dict],
    figure_names: list[str],
    extra: dict,
) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    residential_ids = extra["residential_ids"]
    numeric = csv_info["numeric"]
    utc = csv_info["utc"]
    header = csv_info["header"]

    deltas = np.diff(utc).astype("timedelta64[s]").astype(np.int64)
    unique_deltas = sorted(set(deltas.tolist()))
    n_dup_ts = int(csv_info["n_rows"] - len(set(csv_info["utc"].astype(str).tolist())))
    n_non_900 = int((deltas != INTERVAL_SECONDS).sum())

    interp = csv_info["interpolated"]
    n_interp = int(np.sum(interp != ""))

    lines: list[str] = []
    a = lines.append

    a("# OPSD household data — inspection overview")
    a("")
    a("Read-only inspection of the local Open Power System Data (OPSD) package.")
    a("Raw files were not modified, converted, copied, or filtered.")
    a("No representative profiles, benchmark cohorts, or application code were created.")
    a("")
    a("## Dataset")
    a("")
    a("Local files under `research/opsd/raw/`:")
    a("")
    a("| File | Size | Role |")
    a("| --- | ---: | --- |")
    a(
        f"| `{CSV_NAME}` | {csv_info['size_bytes'] / 1e6:.1f} MB | 15-minute wide CSV (Part 1) |"
    )
    a(
        f"| `{SQLITE_NAME}` | {sqlite_info['size_bytes'] / 1e6:.1f} MB | 1 / 15 / 60-minute SQLite (Part 2) |"
    )
    a("")
    a("Package identity (from OPSD documentation matching these files):")
    a("")
    a("- **Title:** Data Package Household Data")
    a("- **Publisher:** Open Power System Data")
    a("- **Version matching this content:** 2020-04-15")
    a(
        "- **URL:** https://data.open-power-system-data.org/household_data/2020-04-15/"
    )
    a("- **Primary project:** CoSSMic (ISC Konstanz trial site)")
    a("- **Geography:** Konstanz, southern Germany")
    a(
        "- **Units:** cumulative energy in **kWh** as recorded by MID-certified meters, not instantaneous power"
    )
    a(
        "- **Gap handling (publisher):** linear interpolation or fill from prior days; flagged in `interpolated`"
    )
    a("")
    a(
        "Load-curve plots and interval statistics below convert cumulative kWh to interval energy "
        f"(`ΔkWh`) and mean power (`ΔkWh / {INTERVAL_HOURS} h`) **in memory only**."
    )
    a("")
    a("---")
    a("")
    a("## Part 1 — CSV (`household_data_15min_singleindex.csv`)")
    a("")
    a("### Headline facts")
    a("")
    a("| Item | Value |")
    a("| --- | --- |")
    a(f"| Total data rows | {fmt_int(csv_info['n_rows'])} |")
    a(f"| Column count | {len(header)} |")
    a(f"| First UTC timestamp | {str(utc[0])}Z |")
    a(f"| Last UTC timestamp | {str(utc[-1])}Z |")
    a(
        f"| Dataset time span | {str(utc[0]).replace('T', ' ')}Z → {str(utc[-1]).replace('T', ' ')}Z "
        f"(~{extra['span_days']:.1f} days) |"
    )
    a(
        f"| Sampling interval | {INTERVAL_SECONDS} s (15 minutes); "
        f"{n_non_900} non-900 s steps among {fmt_int(len(deltas))} diffs |"
    )
    a(f"| Unique UTC timestamps | {fmt_int(extra['n_unique_ts'])} |")
    a(f"| Duplicated timestamps | {fmt_int(n_dup_ts)} |")
    a(
        f"| Unique sites in column names | {extra['n_sites']} "
        f"({extra['n_residential']} residential, {extra['n_industrial']} industrial, "
        f"{extra['n_public']} public) |"
    )
    a(f"| Unique **residential households** | **{extra['n_residential']}** |")
    a("")
    a("Observed timestamp step sizes (seconds): " + ", ".join(str(x) for x in unique_deltas))
    a("")
    a("### Column names")
    a("")
    a("Wide / single-index layout: one shared time axis, one column per meter feed.")
    a("")
    a("| # | Column |")
    a("| ---: | --- |")
    for i, name in enumerate(header, start=1):
        a(f"| {i} | `{name}` |")
    a("")
    a("### Household / site identifiers")
    a("")
    a(
        "OPSD documents this package as **11 households** in southern Germany. "
        "That count includes industrial buildings and two schools. "
        "For PVNavigator (residential PV + battery), only the six `residential*` sites are households."
    )
    a("")
    a("| Site | Kind | Description | Feeds |")
    a("| --- | --- | --- | --- |")
    for site_id in extra["all_site_ids"]:
        s = sites[site_id]
        feeds = ", ".join(f"`{f}`" for f in s["feeds"])
        a(
            f"| `{site_id}` | {s['kind']} | {s['description']} | {feeds} |"
        )
    a("")
    a("Residential identifiers:")
    a("")
    for site_id in residential_ids:
        a(f"- `{site_id}` — {sites[site_id]['description']}")
    a("")
    a("### Shared timestamps")
    a("")
    a(
        "**Yes — all feeds share identical timestamps by construction.** "
        "The CSV is wide: a single `utc_timestamp` / `cet_cest_timestamp` pair per row. "
        "There is no per-household time index."
    )
    a("")
    a(
        "Coverage still differs: a cell is empty until that meter appears, and again if the "
        "publisher left a gap. So households do **not** share identical *valid* observation windows."
    )
    a("")
    a("### Duplicated timestamps")
    a("")
    if n_dup_ts == 0 and n_non_900 == 0:
        a(
            f"No duplicate UTC timestamps. The 15-minute grid is regular "
            f"({INTERVAL_SECONDS} s) across all {fmt_int(csv_info['n_rows'])} rows."
        )
    else:
        a(
            f"Duplicate UTC timestamps: **{n_dup_ts}**. "
            f"Non-900 s steps: **{n_non_900}**."
        )
    a("")
    a("### Missing values")
    a("")
    a(
        f"Rows with a non-empty `interpolated` flag: **{fmt_int(n_interp)}** "
        f"({100.0 * n_interp / csv_info['n_rows']:.1f}% of rows). "
        "This is **not** the share of interpolated energy: a row is flagged if *any* "
        "listed meter was filled. Most flags are appliance submeters, not whole-house import."
    )
    a("")
    a("Most-flagged columns (publisher interpolation / prior-day fill):")
    a("")
    a("| Column | Flagged rows |")
    a("| --- | ---: |")
    interp_counts = extra["interp_by_column"]
    for col, n in sorted(interp_counts.items(), key=lambda kv: -kv[1])[:12]:
        a(f"| `{col}` | {fmt_int(n)} |")
    a("")
    a("Missingness is dominated by **late starts / early ends**, not salt-and-pepper holes:")
    a("")
    a("| Column | Finite samples | Missing | Missing % | First finite UTC | Last finite UTC |")
    a("| --- | ---: | ---: | ---: | --- | --- |")
    for col in extra["numeric_columns"]:
        span = extra["column_spans"][col]
        a(
            f"| `{col}` | {fmt_int(span['n_finite'])} | {fmt_int(span['n_missing'])} | "
            f"{span['missing_pct']:.1f} | {span['first_utc'] or '—'} | {span['last_utc'] or '—'} |"
        )
    a("")
    a("### Meter jumps / implausible 15-minute power")
    a("")
    a(
        f"An interval is flagged here when `|ΔkWh / 0.25 h| > {IMPLAUSIBLE_KW:.0f} kW` "
        "(far above a typical single-family 15-minute mean). These values remain in the "
        "raw statistics below; load-curve / daily-profile figures omit them so other houses stay readable."
    )
    a("")
    jumps = extra["jumps_by_site"]
    n_res_jumps = sum(1 for s in extra["residential_ids"] if jumps.get(s))
    if n_res_jumps == 0:
        a("No residential `grid_import` interval exceeds this threshold.")
        a("")
        a(
            "Industrial and school `grid_import` routinely exceed 20 kW; that is expected "
            "for those building types and is not treated as a household data-quality issue."
        )
        a("")
    else:
        a("| Site | n intervals > 20 kW | Largest interval | Power (kW) | UTC |")
        a("| --- | ---: | ---: | ---: | --- |")
        residential_jump_rows = 0
        for site_id in extra["residential_ids"]:
            items = jumps.get(site_id, [])
            if not items:
                continue
            residential_jump_rows += 1
            biggest = max(items, key=lambda x: abs(x["power_kw"]))
            a(
                f"| `{site_id}` | {fmt_int(len(items))} | "
                f"{fmt(biggest['interval_kwh'], 3)} kWh | "
                f"{fmt(biggest['power_kw'], 3)} | {biggest['utc']} |"
            )
        if residential_jump_rows == 0:
            a("| — | 0 | — | — | — |")
        a("")
        a(
            "Industrial and school `grid_import` routinely exceed 20 kW; that is expected "
            "for those building types and is not treated as a household data-quality issue."
        )
        a("")
        if jumps.get("residential3"):
            a(
                "`residential3` has a single ~804 kWh cumulative jump in one 15-minute step "
                "(~3,216 kW). That is a meter discontinuity, not household load. It inflates "
                "that site’s max, standard deviation, load-duration peak, and one daily total. "
                "It is **not** a complete-year household (2016 coverage 84%)."
            )
            a("")
    a("### Complete calendar years")
    a("")
    a(
        f"A calendar year is treated as complete when `grid_import` has finite samples for "
        f"≥ {COMPLETE_AVAILABILITY_PCT:.0f}% of the expected 15-minute steps "
        f"(35040 non-leap, 35136 leap). This is an inspection threshold, not a filter."
    )
    a("")
    a(
        f"**Does every household contain a complete year?** "
        f"**{'Yes' if extra['all_residential_have_complete_year'] else 'No'}.** "
        f"{extra['n_residential_with_complete_year']} of {extra['n_residential']} "
        "residential sites have at least one complete `grid_import` year."
    )
    a("")
    a("| Site | Complete years (grid import) | Incomplete years |")
    a("| --- | --- | --- |")
    for site_id in extra["all_site_ids"]:
        years = year_tables[site_id]
        complete = [str(y["year"]) for y in years if y["complete"]]
        incomplete = [str(y["year"]) for y in years if y["n_finite"] and not y["complete"]]
        a(
            f"| `{site_id}` | "
            f"{', '.join(complete) if complete else 'none'} | "
            f"{', '.join(incomplete) if incomplete else '—'} |"
        )
    a("")
    a("Per-year `grid_import` coverage (residential):")
    a("")
    a("| Site | Year | Finite / expected | Availability % | Complete | Grid-import kWh |")
    a("| --- | ---: | ---: | ---: | --- | ---: |")
    for site_id in residential_ids:
        for y in year_tables[site_id]:
            if y["n_finite"] == 0:
                continue
            kwh = fmt(y["span_kwh"]) if y["span_kwh"] is not None else "—"
            a(
                f"| `{site_id}` | {y['year']} | "
                f"{fmt_int(y['n_finite'])} / {fmt_int(y['expected'])} | "
                f"{y['availability_pct']:.1f} | "
                f"{'yes' if y['complete'] else 'no'} | {kwh} |"
            )
    a("")
    a("### Annual electricity consumption")
    a("")
    a(
        "Primary series: **`grid_import`** (cumulative kWh). "
        "Annual energy = last finite reading in the calendar year minus the first finite reading "
        "in that year. This uses the cumulative meter property; gaps do not require filling here."
    )
    a("")
    a(
        "**Caveat:** for sites with PV, `grid_import` is **not** total household electricity. "
        "This CSV has no `consumption` column. Where `pv` and `grid_export` both exist, "
        "a reconstructed load `grid_import + pv − grid_export` is shown as a diagnostic only."
    )
    a("")
    if annual_complete:
        kwhs = [r["span_kwh"] for r in annual_complete]
        a("Complete residential household-years (`grid_import`):")
        a("")
        a("| Site | Year | Annual grid import (kWh) |")
        a("| --- | ---: | ---: |")
        for row in annual_complete:
            a(f"| `{row['site']}` | {row['year']} | {fmt(row['span_kwh'])} |")
        a("")
        a("| Statistic | kWh / year |")
        a("| --- | ---: |")
        a(f"| n (household-years) | {len(kwhs)} |")
        a(f"| Minimum | {fmt(min(kwhs))} |")
        a(f"| Maximum | {fmt(max(kwhs))} |")
        a(f"| Mean | {fmt(float(np.mean(kwhs)))} |")
        a(f"| Median | {fmt(float(np.median(kwhs)))} |")
        a("")
    else:
        a("No residential `grid_import` series meets the complete-year threshold.")
        a("")

    a("Feed totals over each site's full finite span (last − first cumulative reading):")
    a("")
    a("| Site | grid_import kWh | PV kWh | grid_export kWh | heat_pump kWh | EV kWh | Reconstructable load kWh |")
    a("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for site_id in extra["all_site_ids"]:
        st = extra["span_feeds"][site_id]
        recon = "—"
        if st["grid_import"] is not None and st["pv"] is not None and st["grid_export"] is not None:
            recon = fmt(st["grid_import"] + st["pv"] - st["grid_export"])
        a(
            f"| `{site_id}` | "
            f"{fmt(st['grid_import']) if st['grid_import'] is not None else '—'} | "
            f"{fmt(st['pv']) if st['pv'] is not None else '—'} | "
            f"{fmt(st['grid_export']) if st['grid_export'] is not None else '—'} | "
            f"{fmt(st['heat_pump']) if st['heat_pump'] is not None else '—'} | "
            f"{fmt(st['ev']) if st['ev'] is not None else '—'} | "
            f"{recon} |"
        )
    a("")
    a("### Basic statistics for every residential `grid_import` profile")
    a("")
    a(
        "Interval power is `ΔkWh / 0.25 h`. Negative intervals indicate meter resets or corrections. "
        f"`residential3` max ({fmt(profile_stats['residential3']['max_kw'], 1)} kW) is the meter jump above, not a real peak."
    )
    a("")
    a(
        "| Site | Finite intervals | Negative Δ | Span kWh | Mean kW | Median kW | P95 kW | Max kW | Std kW |"
    )
    a("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for site_id in residential_ids:
        st = profile_stats[site_id]
        span = extra["span_feeds"][site_id]["grid_import"]
        a(
            f"| `{site_id}` | {fmt_int(st['n_intervals'])} | {fmt_int(st['n_negative'])} | "
            f"{fmt(span) if span is not None else '—'} | "
            f"{fmt(st['mean_kw'], 3) if st['mean_kw'] is not None else '—'} | "
            f"{fmt(st['median_kw'], 3) if st['median_kw'] is not None else '—'} | "
            f"{fmt(st['p95_kw'], 3) if st['p95_kw'] is not None else '—'} | "
            f"{fmt(st['max_kw'], 3) if st['max_kw'] is not None else '—'} | "
            f"{fmt(st['std_kw'], 3) if st['std_kw'] is not None else '—'} |"
        )
    a("")
    a("Industrial / public `grid_import` (same interval statistics, for completeness):")
    a("")
    a("| Site | Finite intervals | Negative Δ | Span kWh | Mean kW | Median kW | Max kW |")
    a("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for site_id in extra["non_residential_ids"]:
        st = profile_stats[site_id]
        span = extra["span_feeds"][site_id]["grid_import"]
        a(
            f"| `{site_id}` | {fmt_int(st['n_intervals'])} | {fmt_int(st['n_negative'])} | "
            f"{fmt(span) if span is not None else '—'} | "
            f"{fmt(st['mean_kw'], 3) if st['mean_kw'] is not None else '—'} | "
            f"{fmt(st['median_kw'], 3) if st['median_kw'] is not None else '—'} | "
            f"{fmt(st['max_kw'], 3) if st['max_kw'] is not None else '—'} |"
        )
    a("")
    a("### Overview figures")
    a("")
    a(
        "Figures use residential `grid_import` only (the six actual households). "
        f"Daily load curves and the average daily profile omit intervals with `|P| > {IMPLAUSIBLE_KW:.0f} kW`. "
        "The load-duration figure shows raw data (left) and a 0–20 kW zoom (right)."
    )
    a("")
    for name in figure_names:
        a(f"- `{name}`")
    a("")
    a("![All household load curves](load_curves_all_households.png)")
    a("")
    a("![Annual consumption histogram](annual_consumption_histogram.png)")
    a("")
    a("![Daily average load profile](daily_average_load_profile.png)")
    a("")
    a("![Load duration curves](load_duration_curves.png)")
    a("")
    a("---")
    a("")
    a("## Part 2 — SQLite (`household_data.sqlite`)")
    a("")
    a("The SQLite file was **not extracted or resampled**. Only schema, row counts,")
    a("time-span endpoints, and column names were read.")
    a("")
    a("### Available tables")
    a("")
    a("| Table | Rows | First UTC | Last UTC | Interpolated rows | Duplicate timestamps |")
    a("| --- | ---: | --- | --- | ---: | ---: |")
    for table in sqlite_info["tables"]:
        t = sqlite_info["table_info"][table]
        a(
            f"| `{table}` | {fmt_int(t['n_rows'])} | {t['first_utc']} | {t['last_utc']} | "
            f"{fmt_int(t['n_interpolated_rows'])} | {fmt_int(t['duplicate_timestamps'])} |"
        )
    a("")
    a(f"Views: {', '.join(f'`{v}`' for v in sqlite_info['views']) or 'none'}.")
    a("")
    a("Indexes:")
    a("")
    for idx in sqlite_info["indexes"]:
        a(f"- `{idx}`")
    a("")
    a("### Database schema")
    a("")
    a("Three parallel wide tables with the **same column layout**, different time resolution:")
    a("")
    a("- `household_data_1min_singleindex` — 1-minute")
    a("- `household_data_15min_singleindex` — 15-minute (matches the CSV)")
    a("- `household_data_60min_singleindex` — 60-minute")
    a("")
    a("There is **no** separate metadata / household-attribute table, no foreign keys,")
    a("and no `sqlite_sequence`. Quality metadata lives in the `interpolated` text column.")
    a("")
    a("Column types on every table:")
    a("")
    a("| Column | SQLite type |")
    a("| --- | --- |")
    t15 = sqlite_info["table_info"]["household_data_15min_singleindex"]
    for name, typ in t15["column_types"]:
        a(f"| `{name}` | `{typ}` |")
    a("")
    a("### Available columns vs CSV")
    a("")
    a(
        f"15-minute SQLite columns identical to CSV header: "
        f"**{'yes' if sqlite_info['same_columns_as_csv'] else 'no'}**."
    )
    a(
        f"15-minute row count matches CSV ({fmt_int(csv_info['n_rows'])}): "
        f"**{'yes' if sqlite_info['same_15min_row_count'] else 'no'}**."
    )
    a(
        f"15-minute first/last UTC match CSV: "
        f"**{'yes' if sqlite_info['same_15min_time_span'] else 'no'}**."
    )
    a("")
    a("### EV charging data")
    a("")
    if sqlite_info["ev_columns"]:
        a("**Yes.** EV columns:")
        a("")
        for c in sqlite_info["ev_columns"]:
            a(f"- `{c}`")
        a("")
        a(
            "`residential4_ev` is the only **residential** EV charger. "
            "`industrial3_ev` is a research-institute EV feed, not a household."
        )
    else:
        a("**No** column whose name indicates EV charging.")
    a("")
    a("### Heat pump data")
    a("")
    if sqlite_info["heat_pump_columns"]:
        a("**Yes.** Heat pump columns:")
        a("")
        for c in sqlite_info["heat_pump_columns"]:
            a(f"- `{c}`")
        a("")
        a("Two residential heat pumps: `residential1` and `residential4`.")
    else:
        a("**No** heat-pump column.")
    a("")
    a("### PV generation")
    a("")
    if sqlite_info["pv_columns"]:
        a("**Yes.** PV columns:")
        a("")
        for c in sqlite_info["pv_columns"]:
            a(f"- `{c}`")
        a("")
        a(
            "Residential PV: `residential1`, `residential3`, `residential4`, `residential6`. "
            "`residential2` and `residential5` have no PV column."
        )
    else:
        a("**No** PV column.")
    a("")
    a("### Battery storage")
    a("")
    if sqlite_info["battery_columns"]:
        a("**Yes, but not in a residential household.** Columns:")
        a("")
        for c in sqlite_info["battery_columns"]:
            a(f"- `{c}`")
        a("")
        a(
            "Battery charge / discharge exists only on **industrial2** "
            "(crafts-sector building). No residential battery meter is present."
        )
    else:
        a("**No** battery / storage column.")
    a("")
    a("### Available metadata")
    a("")
    a("Present in the database:")
    a("")
    a("- `utc_timestamp`, `cet_cest_timestamp`")
    a("- `interpolated` — publisher gap-fill marker (pipe-separated column names)")
    a("- per-feed cumulative kWh series")
    a("")
    a("**Not** present:")
    a("")
    a("- household floor area, occupancy, tariff, or building fabric")
    a("- heat-pump rated power, COP, or heat-source type")
    a("- EV charger rated power or vehicle model")
    a("- PV kWp, tilt, azimuth")
    a("- battery usable capacity")
    a("- coordinates (Konstanz is documented at package level, not as a table)")
    a("- a separate 15-minute-vs-CSV provenance table")
    a("")
    a("### Relationship between SQLite and the CSV")
    a("")
    a("The CSV is the **15-minute single-index extract** of the same CoSSMic / OPSD package.")
    a("The SQLite file is a **multi-resolution container** of the same wide schema:")
    a("")
    a("| Aspect | CSV | SQLite |")
    a("| --- | --- | --- |")
    a("| 15-minute table | the whole file | `household_data_15min_singleindex` |")
    a(f"| 15-minute rows | {fmt_int(csv_info['n_rows'])} | {fmt_int(t15['n_rows'])} |")
    a("| Columns | 71 | same 71 on all three tables |")
    a(f"| Time span (15 min) | {sqlite_info['csv_first_utc']} → {sqlite_info['csv_last_utc']} | same |")
    a("| 1-minute data | not in this CSV | `household_data_1min_singleindex` (2,307,133 rows) |")
    a("| 60-minute data | not in this CSV | `household_data_60min_singleindex` (38,454 rows) |")
    a("| File size | ~58 MB | ~1.1 GB (dominated by 1-minute) |")
    a("")
    a(
        "1-minute and 60-minute tables were **not** processed. They exist, they share the same "
        "feeds, and their endpoint timestamps sit on the same campaign window "
        "(2014-12-11 → 2019-05-01)."
    )
    a("")
    a("---")
    a("")
    a("## Final assessment")
    a("")
    a("### How many unique households are actually available?")
    a("")
    a(f"**{extra['n_residential']} unique residential households** (`residential1` … `residential6`).")
    a("")
    a(
        f"The package contains **{extra['n_sites']} sites** in total "
        f"({extra['n_residential']} residential, {extra['n_industrial']} industrial, "
        f"{extra['n_public']} public/school). OPSD’s “11 households” wording counts all of them."
    )
    a("")
    a(
        f"{extra['n_residential_with_complete_year']} of the 6 residential sites have at least one "
        f"calendar year with ≥{COMPLETE_AVAILABILITY_PCT:.0f}% `grid_import` coverage. "
        "The campaign window is 2014-12-11 to 2019-05-01; 2014 and 2019 are partial for everyone."
    )
    a("")
    a("### Suitability for validating PVNavigator recommendations")
    a("")
    a(
        "**Not as a primary validation cohort, and not as a drop-in replacement for WPuQ.** "
        "Useful later as a *complementary* research set for EV, appliance-level, and multi-year checks."
    )
    a("")
    a("Reasons it is weak for SpeicherGrenze / BDEW-style recommendation validation today:")
    a("")
    a("1. **Sample size.** Six homes cannot support a distributional check of Eigenverbrauch, Autarkie, or technical Speichergrenze. WPuQ Phase 2 already uses 27 complete 2019 NO_PV houses.")
    a("2. **Meter meaning.** Four of six homes have PV. `grid_import` is then not household demand. WPuQ keeps HOUSEHOLD vs HEATPUMP separate and publishes a corrected `P_TOT` for WITH_PV houses. This OPSD CSV has no equivalent `consumption` feed.")
    a("3. **Mixed end uses on the same import meter.** `residential1` and `residential4` have heat pumps; `residential4` also has EV charging. Without a clean residual household series, a recommendation model that already adds HP/EV on top of BDEW would double-count if fed raw `grid_import`.")
    a("4. **No residential battery measurements.** Storage exists only on industrial2.")
    a("5. **Geography.** Konstanz (south) vs WPuQ (Hamelin district). Weather, HP load, and occupancy patterns are not interchangeable with the current validation climate.")
    a("6. **Publisher gap filling.** Interpolated / prior-day fills are already in the released series. Fine for energy totals; less fine if 15-minute shape is treated as fully measured.")
    a("7. **One serious meter jump.** `residential3` has an ~804 kWh / 3,216 kW single-interval discontinuity. That house also has no complete calendar year.")
    a("")
    a("Where it *is* suitable, after a later dedicated research phase:")
    a("")
    a("- qualitative / case-study checks on **EV charging shape** (`residential4`)")
    a("- heat-pump case studies (`residential1`, `residential4`) against the production HP model")
    a("- multi-year stability of the same home (WPuQ is effectively 2019-centred for COMPLETE years)")
    a("- 1-minute resolution from SQLite (not used here) for peak / cycling diagnostics")
    a("- the two **cleanest household-only** series: `residential2` (no PV, no HP, 2016 complete) and `residential5` (apartment, no PV, 2016–2018 complete)")
    a("")
    a("### How OPSD differs from the existing WPuQ dataset")
    a("")
    a("| | OPSD (this package) | WPuQ (local research set) |")
    a("| --- | --- | --- |")
    a("| Sites | 6 residential + 3 industrial + 2 schools | 38 single-family houses |")
    a("| Location | Konstanz | WPuQ district (Hamelin vicinity) |")
    a("| Years in file | 2014-12 → 2019-05 | 2018, 2019, 2020 (calendar files) |")
    a("| Best full years | several 2015–2018 windows, site-dependent | 2019 COMPLETE (~30 HH + 30 HP) |")
    a("| Resolution here | 15 min CSV; 1 / 15 / 60 min in SQLite | 15 min HDF5 (Phase 1 scope) |")
    a("| Physical quantity | cumulative kWh | instantaneous power W (`P_TOT`) |")
    a("| Household vs HP | HP is a submeter; HH demand not cleanly split | separate HOUSEHOLD and HEATPUMP tables |")
    a("| PV handling | PV as extra cumulative feed; import still contaminated | NO_PV vs WITH_PV groups; corrected `P_TOT` |")
    a("| EV | yes (`residential4`, industrial3) | not in the 15-min SFH tables used so far |")
    a("| Battery | industrial2 only | none in the SFH 15-min tables |")
    a("| Appliance submeters | dishwasher, washing machine, fridge, freezer, … | not used in Phase 1–3 |")
    a("| Production role | none (inspection only) | research/validation only; production stays BDEW H25 |")
    a("| 2019 NO_PV COMPLETE annual HH demand | n/a (different meter definition) | min 1,146 kWh, median 3,058 kWh, max 5,489 kWh (n=27) |")
    a("")
    a("### Advantages OPSD could provide in future")
    a("")
    a("- **EV charging:** a measured residential EV series (`residential4_ev`), which WPuQ does not provide in the current 15-minute SFH extracts. Relevant once PVNavigator EV logic needs a real charging shape rather than a synthetic block.")
    a("- **Heat pumps on a different climate and building stock:** two HP feeds in Konstanz vs ~30 WPuQ HPs in Lower Saxony — a second climate for the HP model, not a larger cohort.")
    a("- **Longer measurements on the same home:** up to four complete calendar years vs WPuQ’s one strong COMPLETE year (2019). Useful for year-to-year variability of Eigenverbrauch assumptions.")
    a("- **Appliance-level structure:** dishwasher / washing machine / refrigeration / circulation pump can test whether evening peaks are appliance-driven.")
    a("- **1-minute data in SQLite:** peak coincidence, HP cycling, and EV session detection without touching production’s 15-minute kernel.")
    a("- **PV + export meters** on several homes: later self-consumption case studies (not recommendation validation until a clean load is reconstructed).")
    a("- **Industrial battery (industrial2):** only as a non-household curiosity; not a residential Speichergrenze measurement.")
    a("")
    a("### Explicitly out of scope for this inspection")
    a("")
    a("- No representative profiles")
    a("- No household filtering / cohort build")
    a("- No benchmark dataset")
    a("- No application or production-code changes")
    a("- No 1-minute extraction from SQLite")
    a("")
    a("---")
    a("")
    a("## How to reproduce")
    a("")
    a("```bash")
    a("/tmp/wpuq-venv/bin/python research/opsd/scripts/inspect_overview.py")
    a("```")
    a("")
    a("Requires `numpy` and `matplotlib` (same research stack as WPuQ).")
    a("")

    (RESULTS_DIR / "overview.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def feed_span(numeric: dict, site_id: str, feed: str, utc: np.ndarray):
    col = f"DE_KN_{site_id}_{feed}"
    if col not in numeric:
        return None
    return finite_span(numeric[col], utc)["span_kwh"]


def main() -> int:
    csv_path = RAW_DIR / CSV_NAME
    sqlite_path = RAW_DIR / SQLITE_NAME
    if not csv_path.is_file():
        raise SystemExit(f"Missing {csv_path}")
    if not sqlite_path.is_file():
        raise SystemExit(f"Missing {sqlite_path}")

    print(f"Loading {csv_path} …")
    csv_info = load_csv(csv_path)
    numeric = csv_info["numeric"]
    utc = csv_info["utc"]
    header = csv_info["header"]

    sites = sites_from_columns(header)
    all_site_ids = sorted(sites, key=lambda s: (sites[s]["kind"], sites[s]["number"]))
    residential_ids = [s for s in all_site_ids if sites[s]["kind"] == "residential"]
    industrial_ids = [s for s in all_site_ids if sites[s]["kind"] == "industrial"]
    public_ids = [s for s in all_site_ids if sites[s]["kind"] == "public"]
    non_residential_ids = industrial_ids + public_ids

    column_spans = {col: finite_span(numeric[col], utc) for col in numeric}
    year_tables: dict[str, list[dict]] = {}
    profile_stats: dict[str, dict] = {}
    span_feeds: dict[str, dict] = {}
    jumps_by_site: dict[str, list[dict]] = {}
    annual_complete: list[dict] = []
    n_interp_rows, interp_by_column = count_interpolated_columns(csv_info["interpolated"])

    for site_id in all_site_ids:
        gi = f"DE_KN_{site_id}_grid_import"
        years = year_coverage(numeric[gi], utc) if gi in numeric else []
        year_tables[site_id] = years
        energy = interval_energy_kwh(numeric[gi]) if gi in numeric else np.array([])
        profile_stats[site_id] = profile_interval_stats(energy)
        jumps_by_site[site_id] = (
            implausible_jumps(energy, utc) if energy.size else []
        )
        span_feeds[site_id] = {
            "grid_import": feed_span(numeric, site_id, "grid_import", utc),
            "pv": feed_span(numeric, site_id, "pv", utc),
            "grid_export": feed_span(numeric, site_id, "grid_export", utc),
            "heat_pump": feed_span(numeric, site_id, "heat_pump", utc),
            "ev": feed_span(numeric, site_id, "ev", utc),
        }
        if sites[site_id]["kind"] == "residential":
            for y in years:
                if y["complete"] and y["span_kwh"] is not None:
                    annual_complete.append(
                        {"site": site_id, "year": y["year"], "span_kwh": y["span_kwh"]}
                    )

    n_res_complete = sum(
        1
        for s in residential_ids
        if any(y["complete"] for y in year_tables[s])
    )

    extra = {
        "n_sites": len(sites),
        "n_residential": len(residential_ids),
        "n_industrial": len(industrial_ids),
        "n_public": len(public_ids),
        "residential_ids": residential_ids,
        "all_site_ids": all_site_ids,
        "non_residential_ids": non_residential_ids,
        "numeric_columns": list(numeric),
        "column_spans": column_spans,
        "span_feeds": span_feeds,
        "span_days": float((utc[-1] - utc[0]) / np.timedelta64(1, "D")),
        "n_unique_ts": len(set(utc.astype(str).tolist())),
        "n_residential_with_complete_year": n_res_complete,
        "all_residential_have_complete_year": n_res_complete == len(residential_ids),
        "jumps_by_site": jumps_by_site,
        "interp_by_column": interp_by_column,
        "n_interp_rows": n_interp_rows,
    }

    print("Inspecting SQLite schema (no extraction) …")
    sqlite_info = inspect_sqlite(sqlite_path, header, csv_info["n_rows"], utc)

    print("Writing figures …")
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    figure_names = plot_figures(
        residential_ids,
        sites,
        numeric,
        utc,
        csv_info["local_slot"],
        annual_complete,
        RESULTS_DIR,
    )

    print("Writing overview.md …")
    write_report(
        csv_info,
        sqlite_info,
        sites,
        year_tables,
        profile_stats,
        annual_complete,
        figure_names,
        extra,
    )
    print(f"Wrote {RESULTS_DIR / 'overview.md'}")
    for name in figure_names:
        print(f"  {RESULTS_DIR / name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
