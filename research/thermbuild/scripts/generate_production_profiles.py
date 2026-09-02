#!/usr/bin/env python3
"""ThermBuild production-profile generator.

The generator is the only place that interprets ThermBuild raw files.
Runtime code must never read the zip; it consumes the JSON assets written
to research/thermbuild/processed/.

Pipeline (deterministic):

  raw zip  →  extract Mar 2025–Feb 2026  →  approved gap fill
           →  kWh  →  rotate onto Jan–Dec  →  unit-normalise
           →  validate  →  write JSON envelopes

Two class prototypes, never averaged:

  TwinHouse O5 (BSE1)  — Luft/Wasser, space heat only
  TwinHouse N2 (BSE2)  — Luft/Wasser, space heat + DHW

Extraction, rotation, and gap-fill follow the ThermBuild → production
research spec (1 Mar 2025 – 28 Feb 2026, consecutive_days + slot-within-day,
no weekday remap, no kNN zip, no smoothing).
"""

from __future__ import annotations

import csv
import io
import json
import math
import sys
import zipfile
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
RAW_DIR = ROOT / "raw"
PROCESSED_DIR = ROOT / "processed"

MEASURE_ZIP = "ThermBuild_measure_raw.zip"
CHANNEL = "hp_elP"
WEATHER_CHANNEL = "wea_Tair_out"

GENERATOR_VERSION = "thermbuild-extract-1"
SCHEMA_VERSION = 1
STEPS = 35040
SLOTS_PER_DAY = 96
TIME_STEP_HOURS = 0.25
DAYS_PER_YEAR = 365
JAN_FEB_DAYS = 31 + 28  # non-leap production calendar

CAMPAIGN_DAY1 = date(2025, 2, 7)
WINDOW_START = date(2025, 3, 1)
WINDOW_END = date(2026, 2, 28)
SOURCE_WINDOW = "2025-03-01/2026-02-28"

METHODOLOGY_SOURCE_ID = "thermbuild-fordatis-486"
LICENSE = "CC-BY-SA-4.0"
TECHNOLOGY = "luftwasser"
QUALITY = "lab-prototype"

ENERGY_DECIMALS = 10
SHARE_DECIMALS = 6
SUM_TOLERANCE = 1e-12
ENERGY_TOLERANCE_KWH = 1e-6
SEASONAL_1DP_TOLERANCE_PP = 0.05  # research table is rounded to 0.1 %
FILL_SHARE_MAX_DELTA_PP = 1.0  # Nov fill may move BSE1 autumn by < 1 pp

SEASONS = {
    "winter": (12, 1, 2),
    "spring": (3, 4, 5),
    "summer": (6, 7, 8),
    "autumn": (9, 10, 11),
}

# Shared production envelope keys. Dataset-specific provenance is extra.
SHARED_REQUIRED_ENVELOPE_KEYS = (
    "schemaVersion",
    "profileId",
    "technology",
    "dhwService",
    "timeStepHours",
    "steps",
    "weights",
    "measuredAnnualElectricalKwh",
    "quality",
    "methodologySourceId",
    "license",
    "generatorVersion",
    "sourceWindow",
    "calendarAlignment",
    "seasonalShares",
    "fillSummary",
)

# Published research seasonal shares (NaN as 0, 1 decimal percent).
RESEARCH_SEASONAL_SHARES_PCT_1DP = {
    "BSE1": {"winter": 50.7, "spring": 26.4, "summer": 1.7, "autumn": 21.3},
    "BSE2": {"winter": 39.5, "spring": 23.1, "summer": 8.4, "autumn": 29.0},
}

# Published research annual electrical energy (NaN as 0, 1 decimal kWh).
RESEARCH_RAW_ANNUAL_KWH_1DP = {
    "BSE1": 2251.3,
    "BSE2": 4370.7,
}


class GeneratorError(RuntimeError):
    """Raised when extraction, fill, or validation fails."""


@dataclass(frozen=True)
class GapSpec:
    start_date: date
    start_slot: int
    length: int
    method: str


@dataclass(frozen=True)
class ProfileSpec:
    bse_tag: str
    profile_id: str
    filename: str
    dhw_service: str
    source_building: str
    expected_gaps: tuple[GapSpec, ...]


PROFILES: tuple[ProfileSpec, ...] = (
    ProfileSpec(
        bse_tag="BSE1",
        profile_id="lw-heating-only-thermbuild-o5-v1",
        filename="lw-heating-only-thermbuild-o5-v1.json",
        dhw_service="space_heat_only",
        source_building="TwinHouse O5 (BSE1)",
        expected_gaps=(
            GapSpec(date(2025, 4, 11), 32, 1, "linear_interpolate"),
            GapSpec(date(2025, 8, 11), 56, 2, "linear_interpolate"),
            GapSpec(date(2025, 10, 7), 34, 15, "same_slot_nearest_adjacent_day"),
            GapSpec(date(2025, 10, 31), 47, 8, "same_slot_nearest_adjacent_day"),
            GapSpec(
                date(2025, 11, 8),
                4,
                223,
                "same_slot_tout_nearest_fully_finite_day_pm7",
            ),
        ),
    ),
    ProfileSpec(
        bse_tag="BSE2",
        profile_id="lw-heating-dhw-thermbuild-n2-v1",
        filename="lw-heating-dhw-thermbuild-n2-v1.json",
        dhw_service="space_heat_and_dhw",
        source_building="TwinHouse N2 (BSE2)",
        expected_gaps=(),
    ),
)


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------


def load_member_from_zip(zip_path: Path, bse_tag: str) -> tuple[str, dict[str, np.ndarray]]:
    with zipfile.ZipFile(zip_path) as zf:
        members = [n for n in zf.namelist() if bse_tag in n and n.endswith(".csv")]
        if len(members) != 1:
            raise GeneratorError(
                f"{zip_path.name}: expected exactly one {bse_tag} CSV, got {members}"
            )
        member = members[0]
        with zf.open(member) as fh:
            text = io.TextIOWrapper(fh, encoding="utf-8", newline="")
            reader = csv.reader(text)
            header = [c.strip() for c in next(reader)]
            rows = [row for row in reader if row and any(c.strip() for c in row)]

    idx = {name: i for i, name in enumerate(header)}
    for required in ("TIME", "consecutive_days", "day_of_the_year", CHANNEL, WEATHER_CHANNEL):
        if required not in idx:
            raise GeneratorError(f"{member}: missing column {required!r}")

    n = len(rows)

    def col(name: str) -> np.ndarray:
        j = idx[name]
        out = np.empty(n, dtype=np.float64)
        for i, row in enumerate(rows):
            if len(row) != len(header):
                raise GeneratorError(
                    f"{member}: row {i + 2} width {len(row)} != header {len(header)}"
                )
            cell = row[j].strip()
            if cell == "" or cell.upper() == "NAN":
                out[i] = np.nan
            else:
                out[i] = float(cell)
        return out

    return member, {
        "TIME": col("TIME"),
        "consecutive_days": col("consecutive_days"),
        "day_of_the_year": col("day_of_the_year"),
        "hp_elP": col(CHANNEL),
        "wea_Tair_out": col(WEATHER_CHANNEL),
    }


def slot_within_day(consecutive_days: np.ndarray) -> np.ndarray:
    """0-based index of each row inside its consecutive_days block (file order)."""
    n = consecutive_days.size
    slots = np.empty(n, dtype=np.int32)
    i = 0
    cd = consecutive_days.astype(np.int64)
    while i < n:
        day = cd[i]
        j = i + 1
        while j < n and cd[j] == day:
            j += 1
        slots[i:j] = np.arange(j - i, dtype=np.int32)
        i = j
    return slots


# ---------------------------------------------------------------------------
# Window extraction
# ---------------------------------------------------------------------------


def extract_window(
    columns: dict[str, np.ndarray],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (el_kw, tair, dates) for every complete 96-slot day in the window.

    Alignment is consecutive_days + slot-within-day, not TIME × 15 min.
    Campaign day 1 = 2025-02-07.
    """
    cd = columns["consecutive_days"]
    if not np.isfinite(cd).all():
        raise GeneratorError("consecutive_days contains non-finite values")
    cd_int = cd.astype(np.int64)
    dates = np.array(
        [CAMPAIGN_DAY1 + timedelta(days=int(x) - 1) for x in cd_int],
        dtype=object,
    )
    slots = slot_within_day(cd_int)

    day_len: dict[int, int] = {}
    for x in cd_int:
        day_len[int(x)] = day_len.get(int(x), 0) + 1

    by_date: dict[date, np.ndarray] = {}
    n = cd_int.size
    i = 0
    while i < n:
        day_id = int(cd_int[i])
        j = i
        while j < n and int(cd_int[j]) == day_id:
            j += 1
        day_date = CAMPAIGN_DAY1 + timedelta(days=day_id - 1)
        if WINDOW_START <= day_date <= WINDOW_END:
            if (j - i) != SLOTS_PER_DAY:
                raise GeneratorError(
                    f"{day_date}: expected {SLOTS_PER_DAY} slots, got {j - i}"
                )
            if not np.array_equal(slots[i:j], np.arange(SLOTS_PER_DAY)):
                raise GeneratorError(f"{day_date}: slot-within-day is not 0..95")
            by_date[day_date] = np.arange(i, j, dtype=np.int64)
        i = j

    expected_days = (WINDOW_END - WINDOW_START).days + 1
    if expected_days != DAYS_PER_YEAR:
        raise GeneratorError(
            f"window {WINDOW_START}..{WINDOW_END} is {expected_days} days, "
            f"expected {DAYS_PER_YEAR}"
        )

    ordered_idx: list[np.ndarray] = []
    cursor = WINDOW_START
    missing: list[str] = []
    while cursor <= WINDOW_END:
        if cursor not in by_date:
            missing.append(cursor.isoformat())
        else:
            ordered_idx.append(by_date[cursor])
        cursor += timedelta(days=1)
    if missing:
        raise GeneratorError(f"missing complete window days: {missing}")

    idx = np.concatenate(ordered_idx)
    if idx.size != STEPS:
        raise GeneratorError(f"window length {idx.size}, expected {STEPS}")

    el = columns["hp_elP"][idx].astype(np.float64, copy=True)
    tair = columns["wea_Tair_out"][idx].astype(np.float64, copy=True)
    win_dates = np.array(
        [WINDOW_START + timedelta(days=d) for d in range(DAYS_PER_YEAR)],
        dtype=object,
    )
    if not np.isfinite(tair).all():
        raise GeneratorError("wea_Tair_out has gaps inside the production window")
    n_neg = int(np.sum(np.isfinite(el) & (el < 0.0)))
    if n_neg:
        raise GeneratorError(f"{CHANNEL} has {n_neg} negative values in the window")
    return el, tair, win_dates


# ---------------------------------------------------------------------------
# Gap fill (approved rules only)
# ---------------------------------------------------------------------------


def nan_runs(mask: np.ndarray) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    n = int(mask.size)
    i = 0
    while i < n:
        if mask[i]:
            j = i + 1
            while j < n and mask[j]:
                j += 1
            runs.append((i, j - i))
            i = j
        else:
            i += 1
    return runs


def day_slot(flat_index: int) -> tuple[int, int]:
    return divmod(flat_index, SLOTS_PER_DAY)


def fill_linear(
    filled: np.ndarray,
    measured: np.ndarray,
    start: int,
    length: int,
) -> dict[str, Any]:
    left = start - 1
    right = start + length
    n = measured.size
    if left < 0 or right >= n:
        raise GeneratorError(
            f"linear interpolate at {start}+{length} has no finite neighbours"
        )
    if not (math.isfinite(measured[left]) and math.isfinite(measured[right])):
        raise GeneratorError(
            f"linear interpolate at {start}+{length}: neighbours are not finite"
        )
    interp = np.linspace(measured[left], measured[right], length + 2)[1:-1]
    filled[start : start + length] = interp
    added_kwh = float(np.sum(interp) * TIME_STEP_HOURS)
    return {
        "method": "linear_interpolate",
        "addedElectricalKwh": round(added_kwh, ENERGY_DECIMALS),
        "donor": None,
    }


def fill_nearest_adjacent_same_slot(
    filled: np.ndarray,
    measured: np.ndarray,
    orig_finite: np.ndarray,
    dates: np.ndarray,
    start: int,
    length: int,
) -> dict[str, Any]:
    di0, si0 = day_slot(start)
    di1, si1 = day_slot(start + length - 1)
    if di0 != di1:
        raise GeneratorError(
            f"same-slot adjacent copy requires an intra-day gap, got {dates[di0]}–{dates[di1]}"
        )
    missing_slots = range(si0, si1 + 1)
    measured_days = measured.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY)
    finite_days = orig_finite.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY)
    donor: int | None = None
    for off in range(1, 8):
        for cand in (di0 - off, di0 + off):
            if cand < 0 or cand >= DAYS_PER_YEAR:
                continue
            if all(bool(finite_days[cand, ss]) for ss in missing_slots):
                donor = cand
                break
        if donor is not None:
            break
    if donor is None:
        raise GeneratorError(
            f"{dates[di0]}: no finite adjacent-day donor within ±7 days"
        )
    copied = measured_days[donor, si0 : si1 + 1]
    filled_days = filled.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY)
    filled_days[di0, si0 : si1 + 1] = copied
    added_kwh = float(np.sum(copied) * TIME_STEP_HOURS)
    return {
        "method": "same_slot_nearest_adjacent_day",
        "addedElectricalKwh": round(added_kwh, ENERGY_DECIMALS),
        "donor": dates[donor].isoformat(),
    }


def fill_tout_nearest_fully_finite(
    filled: np.ndarray,
    measured: np.ndarray,
    orig_finite: np.ndarray,
    tair: np.ndarray,
    dates: np.ndarray,
    start: int,
    length: int,
) -> dict[str, Any]:
    measured_days = measured.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY)
    finite_days = orig_finite.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY)
    tair_days = tair.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY)
    filled_days = filled.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY)
    tmean = tair_days.mean(axis=1)
    fully_finite = finite_days.all(axis=1)

    donors_by_day: dict[int, int] = {}
    added = 0.0
    for k in range(length):
        di, si = day_slot(start + k)
        if di not in donors_by_day:
            t0 = float(tmean[di])
            best: int | None = None
            best_key: tuple[float, int, int] | None = None
            lo = max(0, di - 7)
            hi = min(DAYS_PER_YEAR, di + 8)
            for cand in range(lo, hi):
                if cand == di or not bool(fully_finite[cand]):
                    continue
                key = (abs(float(tmean[cand]) - t0), abs(cand - di), cand)
                if best_key is None or key < best_key:
                    best_key = key
                    best = cand
            if best is None:
                raise GeneratorError(
                    f"{dates[di]}: no fully finite T_out-nearest donor in ±7 days"
                )
            donors_by_day[di] = best
        donor = donors_by_day[di]
        value = float(measured_days[donor, si])
        filled_days[di, si] = value
        added += value * TIME_STEP_HOURS

    donor_map = {
        dates[di].isoformat(): dates[donor].isoformat()
        for di, donor in sorted(donors_by_day.items())
    }
    return {
        "method": "same_slot_tout_nearest_fully_finite_day_pm7",
        "addedElectricalKwh": round(added, ENERGY_DECIMALS),
        "donor": donor_map,
    }


def apply_approved_fill(
    el: np.ndarray,
    tair: np.ndarray,
    dates: np.ndarray,
    spec: ProfileSpec,
) -> tuple[np.ndarray, list[dict[str, Any]]]:
    measured = el.copy()
    orig_finite = np.isfinite(measured)
    runs = nan_runs(~orig_finite)

    expected = [
        (g.start_date, g.start_slot, g.length, g.method) for g in spec.expected_gaps
    ]
    observed: list[tuple[date, int, int]] = []
    for start, length in runs:
        di, si = day_slot(start)
        observed.append((dates[di], int(si), int(length)))

    expected_loc = [(d, s, n) for d, s, n, _ in expected]
    if observed != expected_loc:
        raise GeneratorError(
            f"{spec.bse_tag}: gap runs {observed} do not match the approved table {expected_loc}"
        )

    filled = measured.copy()
    records: list[dict[str, Any]] = []
    for (start, length), gap in zip(runs, spec.expected_gaps):
        di, si = day_slot(start)
        end_index = start + length - 1
        end_di, end_si = day_slot(end_index)
        if gap.method == "linear_interpolate":
            detail = fill_linear(filled, measured, start, length)
        elif gap.method == "same_slot_nearest_adjacent_day":
            detail = fill_nearest_adjacent_same_slot(
                filled, measured, orig_finite, dates, start, length
            )
        elif gap.method == "same_slot_tout_nearest_fully_finite_day_pm7":
            detail = fill_tout_nearest_fully_finite(
                filled, measured, orig_finite, tair, dates, start, length
            )
        else:
            raise GeneratorError(f"unknown fill method {gap.method!r}")
        records.append(
            {
                "startDate": dates[di].isoformat(),
                "startSlot": int(si),
                "endDate": dates[end_di].isoformat(),
                "endSlot": int(end_si),
                "lengthSlots": int(length),
                "lengthHours": round(length * TIME_STEP_HOURS, 4),
                **detail,
            }
        )

    if not np.isfinite(filled).all():
        remaining = int(np.sum(~np.isfinite(filled)))
        raise GeneratorError(f"{spec.bse_tag}: {remaining} NaN slots remain after fill")
    if np.any(filled < 0.0):
        raise GeneratorError(f"{spec.bse_tag}: negative {CHANNEL} after fill")
    return filled, records


# ---------------------------------------------------------------------------
# Calendar rotation and normalisation
# ---------------------------------------------------------------------------


def rotate_to_jan_dec(day_major: np.ndarray) -> np.ndarray:
    """Mar–Feb measured year → production Jan–Dec (non-leap).

    Jan–Feb  ←  1 Jan 2026 … 28 Feb 2026
    Mar–Dec  ←  1 Mar 2025 … 31 Dec 2025
    """
    if day_major.shape != (DAYS_PER_YEAR, SLOTS_PER_DAY):
        raise GeneratorError(f"rotate: shape {day_major.shape}")
    rotated = np.concatenate(
        [day_major[DAYS_PER_YEAR - JAN_FEB_DAYS :], day_major[: DAYS_PER_YEAR - JAN_FEB_DAYS]],
        axis=0,
    )
    return rotated


def production_dates() -> np.ndarray:
    jan1 = date(2026, 1, 1)
    mar1 = date(2025, 3, 1)
    days = [jan1 + timedelta(days=i) for i in range(JAN_FEB_DAYS)]
    days.extend(mar1 + timedelta(days=i) for i in range(DAYS_PER_YEAR - JAN_FEB_DAYS))
    return np.array(days, dtype=object)


def seasonal_shares(energy_kwh: np.ndarray, months: np.ndarray) -> dict[str, float]:
    total = float(np.sum(energy_kwh))
    if total <= 0.0:
        raise GeneratorError("seasonal shares: energy sum is not positive")
    out: dict[str, float] = {}
    for name, month_ids in SEASONS.items():
        mask = np.isin(months, month_ids)
        out[name] = float(np.sum(energy_kwh[mask]) / total)
    return out


def unit_weights(energy_kwh: np.ndarray) -> list[float]:
    """Unit-normalise energy to JSON-stable weights that sum to 1."""
    total = float(np.sum(energy_kwh))
    if total <= 0.0:
        raise GeneratorError("cannot normalise a non-positive energy series")
    raw = [float(x) for x in (energy_kwh / total).tolist()]
    encoded: list[float] = json.loads(json.dumps(raw, ensure_ascii=True))
    drift = 1.0 - math.fsum(encoded)
    i = max(range(len(encoded)), key=lambda k: encoded[k])
    encoded[i] = encoded[i] + drift
    encoded = json.loads(json.dumps(encoded, ensure_ascii=True))
    if any(x < 0.0 for x in encoded):
        raise GeneratorError("normalisation produced a negative weight")
    if abs(math.fsum(encoded) - 1.0) > SUM_TOLERANCE:
        raise GeneratorError(
            f"JSON weights sum to {math.fsum(encoded)!r}, expected 1.0"
        )
    return encoded


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def round_pct_1dp(share: float) -> float:
    return round(share * 100.0, 1)


def validate_profile(
    spec: ProfileSpec,
    raw_energy: np.ndarray,
    filled_energy: np.ndarray,
    rotated_energy: np.ndarray,
    weights: np.ndarray | list[float],
    months_window: np.ndarray,
    months_prod: np.ndarray,
) -> dict[str, Any]:
    errors: list[str] = []

    weights_arr = np.asarray(weights, dtype=np.float64)
    if rotated_energy.size != STEPS or weights_arr.size != STEPS:
        errors.append(f"length {rotated_energy.size}/{weights_arr.size}, expected {STEPS}")
    if not np.isfinite(weights_arr).all() or not np.isfinite(rotated_energy).all():
        errors.append("non-finite values in energy or weights")
    if np.any(weights_arr < 0.0) or np.any(rotated_energy < 0.0):
        errors.append("negative values in energy or weights")

    weight_sum = math.fsum(float(x) for x in np.asarray(weights, dtype=np.float64).tolist())
    if abs(weight_sum - 1.0) > SUM_TOLERANCE:
        errors.append(f"sum(weights)={weight_sum!r}, expected 1.0")

    raw_annual = float(np.sum(raw_energy))
    filled_annual = float(np.sum(filled_energy))
    rotated_annual = float(np.sum(rotated_energy))
    if abs(rotated_annual - filled_annual) > ENERGY_TOLERANCE_KWH:
        errors.append(
            f"rotation changed annual energy {filled_annual} → {rotated_annual}"
        )

    reconstructed = weights_arr * filled_annual
    if abs(float(np.sum(reconstructed)) - filled_annual) > ENERGY_TOLERANCE_KWH:
        errors.append("weights do not preserve annual electrical energy")

    expected_raw_1dp = RESEARCH_RAW_ANNUAL_KWH_1DP[spec.bse_tag]
    raw_1dp = round(raw_annual, 1)
    if raw_1dp != expected_raw_1dp:
        errors.append(
            f"raw annual {raw_1dp} kWh != research {expected_raw_1dp} kWh"
        )

    raw_shares = seasonal_shares(raw_energy, months_window)
    filled_shares = seasonal_shares(filled_energy, months_window)
    weight_shares = seasonal_shares(np.asarray(weights, dtype=np.float64), months_prod)
    research = RESEARCH_SEASONAL_SHARES_PCT_1DP[spec.bse_tag]

    for season, expected_pct in research.items():
        got = round_pct_1dp(raw_shares[season])
        if abs(got - expected_pct) > SEASONAL_1DP_TOLERANCE_PP:
            errors.append(
                f"raw {season} share {got}% != research {expected_pct}%"
            )
        filled_pct = filled_shares[season] * 100.0
        if abs(filled_pct - expected_pct) > FILL_SHARE_MAX_DELTA_PP:
            errors.append(
                f"filled {season} share {filled_pct:.3f}% drifted > "
                f"{FILL_SHARE_MAX_DELTA_PP} pp from research {expected_pct}%"
            )
        if abs(weight_shares[season] - filled_shares[season]) > 1e-10:
            errors.append(
                f"weight {season} share {weight_shares[season]} "
                f"!= filled {filled_shares[season]}"
            )

    required_meta = SHARED_REQUIRED_ENVELOPE_KEYS
    # Presence is checked on the envelope in write_envelope.

    if errors:
        raise GeneratorError(
            f"{spec.profile_id} validation failed:\n  - " + "\n  - ".join(errors)
        )

    return {
        "rawAnnualElectricalKwh": round(raw_annual, ENERGY_DECIMALS),
        "measuredAnnualElectricalKwh": round(filled_annual, ENERGY_DECIMALS),
        "weightSum": weight_sum,
        "rawSeasonalSharesPct1dp": {
            k: round_pct_1dp(v) for k, v in raw_shares.items()
        },
        "filledSeasonalShares": {
            k: round(v, SHARE_DECIMALS) for k, v in filled_shares.items()
        },
        "weightSeasonalShares": {
            k: round(v, SHARE_DECIMALS) for k, v in weight_shares.items()
        },
        "researchSeasonalSharesPct1dp": dict(research),
        "requiredMetaKeys": list(required_meta),
    }


def assert_seasonal_shares(shares: Any, spec: ProfileSpec) -> None:
    if not isinstance(shares, dict):
        raise GeneratorError(f"{spec.profile_id}: seasonalShares is not an object")
    missing = [name for name in SEASONS if name not in shares]
    if missing:
        raise GeneratorError(f"{spec.profile_id}: seasonalShares missing {missing}")
    total = 0.0
    for name in SEASONS:
        value = shares[name]
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0.0:
            raise GeneratorError(f"{spec.profile_id}: seasonalShares.{name} is invalid")
        total += float(value)
    if abs(total - 1.0) > 1e-5:
        raise GeneratorError(
            f"{spec.profile_id}: seasonalShares sum to {total!r}, expected 1.0"
        )


def assert_metadata_complete(envelope: dict[str, Any], spec: ProfileSpec) -> None:
    required = SHARED_REQUIRED_ENVELOPE_KEYS
    missing = [k for k in required if k not in envelope or envelope[k] in (None, "")]
    if missing:
        raise GeneratorError(f"{spec.profile_id}: missing metadata {missing}")
    if envelope["schemaVersion"] != SCHEMA_VERSION:
        raise GeneratorError("schemaVersion mismatch")
    if envelope["profileId"] != spec.profile_id:
        raise GeneratorError("profileId mismatch")
    if envelope["steps"] != STEPS or len(envelope["weights"]) != STEPS:
        raise GeneratorError("steps/weights length mismatch")
    if envelope["methodologySourceId"] != METHODOLOGY_SOURCE_ID:
        raise GeneratorError("methodologySourceId mismatch")
    if not isinstance(envelope["calendarAlignment"], str) or not envelope[
        "calendarAlignment"
    ].strip():
        raise GeneratorError("calendarAlignment is empty")
    assert_seasonal_shares(envelope["seasonalShares"], spec)
    if "http://" in json.dumps(envelope, default=str) or "https://" in json.dumps(
        envelope, default=str
    ):
        raise GeneratorError("envelope must not embed URLs")


# ---------------------------------------------------------------------------
# Envelope I/O
# ---------------------------------------------------------------------------


def build_envelope(
    spec: ProfileSpec,
    member: str,
    weights: list[float],
    fill_records: list[dict[str, Any]],
    validation: dict[str, Any],
) -> dict[str, Any]:
    added = (
        float(validation["measuredAnnualElectricalKwh"])
        - float(validation["rawAnnualElectricalKwh"])
    )
    fill_summary: dict[str, Any] = {
        "nGapsRepaired": len(fill_records),
        "nSlotsFilled": int(sum(int(r["lengthSlots"]) for r in fill_records)),
        "addedElectricalKwh": round(added, ENERGY_DECIMALS),
        "rules": (
            "linear_interpolate for 1-2 slot gaps; "
            "same-slot copy from the nearest finite adjacent day for 8- and 15-slot gaps; "
            "same-slot copy from the T_out-nearest fully finite day in +/-7 days "
            "for the 223-slot 8-10 Nov 2025 gap. "
            "No kNN, no rolling mean, no weekday remap."
        ),
        "gaps": fill_records,
    }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "profileId": spec.profile_id,
        "technology": TECHNOLOGY,
        "dhwService": spec.dhw_service,
        "timeStepHours": TIME_STEP_HOURS,
        "steps": STEPS,
        "weights": list(weights) if not isinstance(weights, list) else weights,
        "measuredAnnualElectricalKwh": validation["measuredAnnualElectricalKwh"],
        "quality": QUALITY,
        "methodologySourceId": METHODOLOGY_SOURCE_ID,
        "license": LICENSE,
        "generatorVersion": GENERATOR_VERSION,
        "sourceWindow": SOURCE_WINDOW,
        "fillSummary": fill_summary,
        "sourceDataset": "ThermBuild",
        "sourceBuilding": spec.source_building,
        "sourceChannel": CHANNEL,
        "sourceZip": MEASURE_ZIP,
        "sourceMember": member,
        "calendarAlignment": "consecutive_days + slot-within-day; campaign day 1 = 2025-02-07",
        "rotation": (
            "Jan-Feb from 2026-01-01..2026-02-28; "
            "Mar-Dec from 2025-03-01..2025-12-31"
        ),
        "seasonalShares": validation["weightSeasonalShares"],
        "researchSeasonalSharesPct1dp": validation["researchSeasonalSharesPct1dp"],
        "rawAnnualElectricalKwh": validation["rawAnnualElectricalKwh"],
    }


def write_envelope(path: Path, envelope: dict[str, Any]) -> None:
    weights = envelope["weights"]
    payload = dict(envelope)
    payload["weights"] = "__WEIGHTS__"
    text = json.dumps(payload, indent=2, ensure_ascii=True)
    weights_json = json.dumps(weights, ensure_ascii=True)
    text = text.replace('"__WEIGHTS__"', weights_json)
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(text, encoding="utf-8")


def validate_written_file(path: Path, spec: ProfileSpec) -> dict[str, Any]:
    """Re-parse the asset as a runtime consumer would. Fail loudly."""
    text = path.read_text(encoding="utf-8")
    if "http://" in text or "https://" in text:
        raise GeneratorError(f"{path.name}: written JSON embeds a URL")
    data = json.loads(text)
    assert_metadata_complete(data, spec)
    weights = data["weights"]
    if not isinstance(weights, list) or len(weights) != STEPS:
        raise GeneratorError(f"{path.name}: weights length {len(weights)}")
    if any(not isinstance(x, (int, float)) or not math.isfinite(x) for x in weights):
        raise GeneratorError(f"{path.name}: non-finite weight")
    if any(x < 0.0 for x in weights):
        raise GeneratorError(f"{path.name}: negative weight")
    weight_sum = math.fsum(float(x) for x in weights)
    if abs(weight_sum - 1.0) > SUM_TOLERANCE:
        raise GeneratorError(f"{path.name}: sum(weights)={weight_sum!r} after reload")
    measured = float(data["measuredAnnualElectricalKwh"])
    recon = math.fsum(float(x) * measured for x in weights)
    if abs(recon - measured) > ENERGY_TOLERANCE_KWH:
        raise GeneratorError(
            f"{path.name}: reloaded weights do not preserve {measured} kWh"
        )
    return {"reloadedWeightSum": weight_sum, "reloadedEnergyKwh": recon}


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def generate_one(
    zip_path: Path,
    spec: ProfileSpec,
) -> tuple[dict[str, Any], dict[str, Any]]:
    member, columns = load_member_from_zip(zip_path, spec.bse_tag)
    el, tair, dates = extract_window(columns)

    months_window = np.array([d.month for d in dates], dtype=np.int16)
    months_window = np.repeat(months_window, SLOTS_PER_DAY)

    raw_energy = np.where(np.isfinite(el), el * TIME_STEP_HOURS, 0.0)
    filled_kw, fill_records = apply_approved_fill(el, tair, dates, spec)
    filled_energy = filled_kw * TIME_STEP_HOURS

    rotated = rotate_to_jan_dec(filled_energy.reshape(DAYS_PER_YEAR, SLOTS_PER_DAY))
    rotated_energy = rotated.reshape(-1)
    prod_dates = production_dates()
    months_prod = np.repeat(
        np.array([d.month for d in prod_dates], dtype=np.int16),
        SLOTS_PER_DAY,
    )

    weights = unit_weights(rotated_energy)
    validation = validate_profile(
        spec,
        raw_energy,
        filled_energy,
        rotated_energy,
        weights,
        months_window,
        months_prod,
    )
    envelope = build_envelope(spec, member, weights, fill_records, validation)
    assert_metadata_complete(envelope, spec)
    return envelope, validation


def main() -> int:
    zip_path = RAW_DIR / MEASURE_ZIP
    if not zip_path.is_file():
        raise GeneratorError(f"missing raw dataset: {zip_path}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    reports: list[tuple[ProfileSpec, dict[str, Any], dict[str, Any]]] = []

    for spec in PROFILES:
        envelope, validation = generate_one(zip_path, spec)
        out_path = PROCESSED_DIR / spec.filename
        write_envelope(out_path, envelope)
        written_check = validate_written_file(out_path, spec)
        validation = {**validation, **written_check}
        written.append(out_path)
        reports.append((spec, envelope, validation))

    print("ThermBuild production generator")
    print(f"  generatorVersion  {GENERATOR_VERSION}")
    print(f"  source            {MEASURE_ZIP}")
    print(f"  window            {SOURCE_WINDOW}")
    print(f"  steps             {STEPS}")
    print()
    for spec, envelope, validation in reports:
        fill = envelope["fillSummary"]
        print(spec.filename)
        print(f"  profileId                       {envelope['profileId']}")
        print(f"  technology / dhwService         {envelope['technology']} / {envelope['dhwService']}")
        print(f"  sourceBuilding                  {envelope['sourceBuilding']}")
        print(f"  quality                         {envelope['quality']}")
        print(f"  license                         {envelope['license']}")
        print(f"  methodologySourceId             {envelope['methodologySourceId']}")
        print(
            f"  measuredAnnualElectricalKwh     {envelope['measuredAnnualElectricalKwh']}"
        )
        print(f"  rawAnnualElectricalKwh          {envelope['rawAnnualElectricalKwh']}")
        print(f"  nGapsRepaired                   {fill['nGapsRepaired']}")
        print(f"  nSlotsFilled                    {fill['nSlotsFilled']}")
        print(f"  addedElectricalKwh              {fill['addedElectricalKwh']}")
        print("  seasonalShares (weights)")
        for season in ("winter", "spring", "summer", "autumn"):
            share = envelope["seasonalShares"][season]
            research_pct = envelope["researchSeasonalSharesPct1dp"][season]
            print(
                f"    {season:6s}  {share:.4f}  "
                f"({share * 100:.1f}%)  research {research_pct:.1f}%"
            )
        print("  fill gaps")
        if fill["gaps"]:
            for gap in fill["gaps"]:
                print(
                    f"    {gap['startDate']} slot {gap['startSlot']}  "
                    f"len={gap['lengthSlots']}  {gap['method']}  "
                    f"donor={gap['donor']}  +{gap['addedElectricalKwh']} kWh"
                )
        else:
            print("    (none)")
        print(
            f"  validation  OK  "
            f"n={STEPS}  finite  >=0  "
            f"sum(weights)={validation['weightSum']!r}  "
            f"reloaded={validation.get('reloadedWeightSum')!r}"
        )
        print()

    print("wrote:")
    for path in written:
        print(f"  {path.relative_to(ROOT.parent.parent)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except GeneratorError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
