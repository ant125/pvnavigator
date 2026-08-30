"""Shared helpers for WPuQ Phase 1 research scripts."""

from __future__ import annotations

import json
import re
from calendar import isleap
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import h5py
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "raw"
PROCESSED_DIR = ROOT / "processed"
THRESHOLDS_PATH = ROOT / "thresholds.json"
EXPECTED_RAW_FILES = (
    "2018_data_15min.hdf5",
    "2019_data_15min.hdf5",
    "2020_data_15min.hdf5",
)

YEAR_RE = re.compile(r"^(20\d{2})_data_15min\.hdf5$")
HOUSE_RE = re.compile(r"^SFH\d+$")


def load_thresholds() -> dict[str, Any]:
    with THRESHOLDS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def expected_intervals(year: int) -> int:
    """Quarter-hour steps in a calendar year (keeps Feb 29 in leap years)."""
    days = 366 if isleap(year) else 365
    return days * 24 * 4


def list_raw_files() -> list[Path]:
    found = []
    for name in EXPECTED_RAW_FILES:
        path = RAW_DIR / name
        if path.is_file():
            found.append(path)
    # Also pick up unexpected *_data_15min.hdf5 if present
    for path in sorted(RAW_DIR.glob("*_data_15min.hdf5")):
        if path not in found:
            found.append(path)
    return found


def year_from_filename(path: Path) -> int:
    match = YEAR_RE.match(path.name)
    if not match:
        raise ValueError(f"Unexpected WPuQ filename: {path.name}")
    return int(match.group(1))


def classify_availability(availability_pct: float, thresholds: dict[str, Any]) -> str:
    rules = thresholds["classification"]
    complete_min = rules["COMPLETE"]["min_availability_pct"]
    usable_min = rules["USABLE_WITH_SMALL_GAPS"]["min_availability_pct"]
    incomplete_min = rules["INCOMPLETE"]["min_availability_pct"]

    if availability_pct >= complete_min:
        return "COMPLETE"
    if availability_pct >= usable_min:
        return "USABLE_WITH_SMALL_GAPS"
    if availability_pct >= incomplete_min:
        return "INCOMPLETE"
    return "EXCLUDE"


def unix_to_iso(ts: int | float | None) -> str | None:
    if ts is None or (isinstance(ts, float) and np.isnan(ts)):
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()


def house_sort_key(house_id: str) -> int:
    return int(house_id.replace("SFH", ""))


def iter_sfh_houses(h5: h5py.File) -> list[tuple[str, str]]:
    """Return (pv_group, house_id) for all SFH nodes under NO_PV / WITH_PV."""
    out: list[tuple[str, str]] = []
    for pv_group in ("NO_PV", "WITH_PV"):
        if pv_group not in h5:
            continue
        for house_id in sorted(h5[pv_group].keys(), key=house_sort_key):
            if HOUSE_RE.match(house_id):
                out.append((pv_group, house_id))
    return out


def dataset_path(pv_group: str, house_id: str, feed: str) -> str:
    return f"{pv_group}/{house_id}/{feed}/table"


def feed_exists(h5: h5py.File, pv_group: str, house_id: str, feed: str) -> bool:
    return dataset_path(pv_group, house_id, feed) in h5


def read_table(h5: h5py.File, pv_group: str, house_id: str, feed: str) -> np.ndarray:
    return h5[dataset_path(pv_group, house_id, feed)][:]


def analyze_power_series(
    table: np.ndarray,
    *,
    year: int,
    power_column: str,
    contaminated_column: str | None,
    interval_seconds: int,
    energy_wh_per_watt: float,
    thresholds: dict[str, Any],
) -> dict[str, Any]:
    names = table.dtype.names or ()
    if "index" not in names:
        raise KeyError("table missing index column")
    if power_column not in names:
        raise KeyError(f"table missing power column {power_column}")

    index = np.asarray(table["index"], dtype=np.int64)
    power = np.asarray(table[power_column], dtype=np.float64)
    expected = expected_intervals(year)
    n_rows = int(power.shape[0])

    finite_mask = np.isfinite(power)
    available = int(finite_mask.sum())
    missing = int(expected - available) if n_rows == expected else int(n_rows - available)
    # Prefer expected-based missing when row count matches calendar grid
    if n_rows == expected:
        missing_intervals = int((~finite_mask).sum())
    else:
        # Irregular length: count NaNs in file + shortfall vs expected
        missing_intervals = int((~finite_mask).sum()) + max(0, expected - n_rows)

    availability_pct = (100.0 * available / expected) if expected else 0.0
    classification = classify_availability(availability_pct, thresholds)

    first_ts = int(index[finite_mask][0]) if available else None
    last_ts = int(index[finite_mask][-1]) if available else None
    first_grid_ts = int(index[0]) if n_rows else None
    last_grid_ts = int(index[-1]) if n_rows else None

    # Gap run lengths (in intervals) on the file grid
    gap_runs: list[int] = []
    if n_rows:
        run = 0
        for ok in finite_mask:
            if not ok:
                run += 1
            elif run:
                gap_runs.append(run)
                run = 0
        if run:
            gap_runs.append(run)

    # Energy from mean power over 15 min: kWh = W * 0.25 h / 1000
    energy_kwh = float(np.nansum(power[finite_mask]) * energy_wh_per_watt / 1000.0)
    negative_count = int(np.nansum(power[finite_mask] < 0))

    contaminated_energy_kwh = None
    contaminated_negative_count = None
    has_contaminated_column = bool(
        contaminated_column and contaminated_column in names
    )
    if has_contaminated_column and contaminated_column is not None:
        cont = np.asarray(table[contaminated_column], dtype=np.float64)
        cont_finite = np.isfinite(cont)
        contaminated_energy_kwh = float(
            np.nansum(cont[cont_finite]) * energy_wh_per_watt / 1000.0
        )
        contaminated_negative_count = int(np.nansum(cont[cont_finite] < 0))

    dt = np.diff(index) if n_rows > 1 else np.array([], dtype=np.int64)
    irregular_steps = int(np.sum(dt != interval_seconds)) if dt.size else 0

    return {
        "columns": list(names),
        "row_count": n_rows,
        "expected_intervals": expected,
        "available_intervals": available,
        "missing_intervals": missing_intervals,
        "availability_pct": round(availability_pct, 4),
        "has_nan_or_gaps": bool(missing_intervals > 0 or irregular_steps > 0),
        "nan_count": int((~finite_mask).sum()),
        "gap_run_count": len(gap_runs),
        "longest_gap_intervals": int(max(gap_runs) if gap_runs else 0),
        "irregular_timestep_count": irregular_steps,
        "first_timestamp_unix": first_ts,
        "last_timestamp_unix": last_ts,
        "first_timestamp_iso_utc": unix_to_iso(first_ts),
        "last_timestamp_iso_utc": unix_to_iso(last_ts),
        "grid_first_timestamp_unix": first_grid_ts,
        "grid_last_timestamp_unix": last_grid_ts,
        "grid_first_timestamp_iso_utc": unix_to_iso(first_grid_ts),
        "grid_last_timestamp_iso_utc": unix_to_iso(last_grid_ts),
        "power_column_used": power_column,
        "energy_kwh_finite_only": round(energy_kwh, 3),
        "negative_power_sample_count": negative_count,
        "has_pv_contaminated_column": has_contaminated_column,
        "contaminated_column": contaminated_column if has_contaminated_column else None,
        "contaminated_energy_kwh_finite_only": (
            round(contaminated_energy_kwh, 3)
            if contaminated_energy_kwh is not None
            else None
        ),
        "contaminated_negative_power_sample_count": contaminated_negative_count,
        "completeness_class": classification,
        "incomplete_year_flag": classification in ("INCOMPLETE", "EXCLUDE")
        or availability_pct < thresholds["classification"]["COMPLETE"]["min_availability_pct"],
        "usable_for_benchmark": classification
        in thresholds.get("usable_for_benchmark_classes", []),
    }
