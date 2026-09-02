#!/usr/bin/env python3
"""WPuQ Wasser/Wasser production-profile generator.

The generator is the only place that interprets the WPuQ HDF5 files.
Runtime code must never read the HDF5; it consumes the JSON asset written
to research/wpuq/processed/.

Profile-id grammar (shared with ThermBuild):

    {tech}-{dhw}-{dataset}-{optionalYear}-{building}-v{n}

  ww-heating-dhw-wpuq-2019-sfh38-v1

This asset is not a production catalogue default until a later integration
step. Robustness houses stay under processed/robustness/ with their own ids.

Pipeline (deterministic):

  2019 HDF5  →  extract NO_PV/SFH38/HEATPUMP/P_TOT
             →  validate complete 15-min 2019 year
             →  W → interval kWh  →  unit-normalise
             →  validate  →  write JSON envelope

One selected field series, never averaged:

  SFH38 2019 HEATPUMP P_TOT  — Wasser/Wasser, space heat + DHW

No household meter. No interval average. No cohort average.
No research gap fill. SFH4 is out of scope for this generator.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import h5py
import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
RAW_DIR = ROOT / "raw"
PROCESSED_DIR = ROOT / "processed"

SOURCE_FILE = "2019_data_15min.hdf5"
PV_GROUP = "NO_PV"
HOUSE_ID = "SFH38"
FEED = "HEATPUMP"
CHANNEL = "P_TOT"
SOURCE_PATH = f"{PV_GROUP}/{HOUSE_ID}/{FEED}/table"

GENERATOR_VERSION = "wpuq-hp-extract-1"
SCHEMA_VERSION = 1
STEPS = 35040
SLOTS_PER_DAY = 96
TIME_STEP_HOURS = 0.25
INTERVAL_SECONDS = 900
YEAR = 2019
SOURCE_WINDOW = "2019-01-01/2019-12-31"
SEASONAL_TZ = ZoneInfo("Europe/Berlin")

# 2019-01-01T00:00:00Z … 2019-12-31T23:45:00Z on a 900 s grid.
YEAR_START_UNIX = 1_546_300_800
YEAR_END_UNIX = 1_577_835_900

METHODOLOGY_SOURCE_ID = "wpuq-wasserwasser-heatpump"
LICENSE = "CC-BY-4.0"
TECHNOLOGY = "wasserwasser"
QUALITY = "field-cohort-representative"
DHW_SERVICE = "space_heat_and_dhw"

ENERGY_DECIMALS = 10
SHARE_DECIMALS = 6
SUM_TOLERANCE = 1e-12
ENERGY_TOLERANCE_KWH = 1e-6

# Audited Phase 1 inventory annual (finite P_TOT, 3 decimal kWh).
EXPECTED_ANNUAL_KWH_3DP = 5662.099

STANDBY_MAX_W = 100.0

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


class GeneratorError(RuntimeError):
    """Raised when extraction or validation fails."""


@dataclass(frozen=True)
class ProfileSpec:
    profile_id: str
    filename: str
    house_id: str
    pv_group: str
    year: int
    dhw_service: str
    source_building: str


PROFILE = ProfileSpec(
    profile_id="ww-heating-dhw-wpuq-2019-sfh38-v1",
    filename="ww-heating-dhw-wpuq-2019-sfh38-v1.json",
    house_id=HOUSE_ID,
    pv_group=PV_GROUP,
    year=YEAR,
    dhw_service=DHW_SERVICE,
    source_building=HOUSE_ID,
)


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------


def dataset_path(spec: ProfileSpec) -> str:
    return f"{spec.pv_group}/{spec.house_id}/{FEED}/table"


def load_heatpump_table(h5_path: Path, spec: ProfileSpec) -> np.ndarray:
    path = dataset_path(spec)
    with h5py.File(h5_path, "r") as h5:
        if path not in h5:
            raise GeneratorError(f"{h5_path.name}: missing dataset {path}")
        table = h5[path][:]
    names = table.dtype.names or ()
    if "index" not in names:
        raise GeneratorError(f"{path}: missing index column")
    if CHANNEL not in names:
        raise GeneratorError(f"{path}: missing power column {CHANNEL!r}")
    return table


# ---------------------------------------------------------------------------
# Extraction and validation of the raw series
# ---------------------------------------------------------------------------


def extract_series(table: np.ndarray, spec: ProfileSpec) -> tuple[np.ndarray, np.ndarray]:
    index = np.asarray(table["index"], dtype=np.int64)
    power_w = np.asarray(table[CHANNEL], dtype=np.float64)
    n = int(power_w.size)
    path = dataset_path(spec)

    if n != STEPS:
        raise GeneratorError(f"{path}: {n} intervals, expected {STEPS}")
    if not np.isfinite(power_w).all():
        n_nan = int(np.sum(~np.isfinite(power_w)))
        raise GeneratorError(f"{path}: {n_nan} NaN values in {CHANNEL}")
    n_neg = int(np.sum(power_w < 0.0))
    if n_neg:
        raise GeneratorError(f"{path}: {n_neg} negative values in {CHANNEL}")

    if index.size != STEPS:
        raise GeneratorError(f"{path}: index length {index.size}, expected {STEPS}")
    if not np.isfinite(index.astype(np.float64)).all():
        raise GeneratorError(f"{path}: index contains non-finite values")

    dt = np.diff(index)
    n_irregular = int(np.sum(dt != INTERVAL_SECONDS))
    if n_irregular:
        raise GeneratorError(
            f"{path}: {n_irregular} irregular timesteps, expected constant {INTERVAL_SECONDS} s"
        )
    if int(index[0]) != YEAR_START_UNIX or int(index[-1]) != YEAR_END_UNIX:
        raise GeneratorError(
            f"{path}: grid {int(index[0])}…{int(index[-1])}, "
            f"expected {YEAR_START_UNIX}…{YEAR_END_UNIX} (complete {YEAR} UTC year)"
        )

    first_utc = datetime.fromtimestamp(int(index[0]), tz=timezone.utc)
    last_utc = datetime.fromtimestamp(int(index[-1]), tz=timezone.utc)
    if first_utc.year != YEAR or last_utc.year != YEAR:
        raise GeneratorError(
            f"{path}: timestamps {first_utc.isoformat()}…{last_utc.isoformat()} "
            f"are not a complete {YEAR} year"
        )
    if first_utc.month != 1 or first_utc.day != 1 or first_utc.hour != 0 or first_utc.minute != 0:
        raise GeneratorError(f"{path}: first stamp {first_utc.isoformat()} is not {YEAR}-01-01T00:00Z")
    if last_utc.month != 12 or last_utc.day != 31 or last_utc.hour != 23 or last_utc.minute != 45:
        raise GeneratorError(f"{path}: last stamp {last_utc.isoformat()} is not {YEAR}-12-31T23:45Z")

    expected = np.arange(YEAR_START_UNIX, YEAR_END_UNIX + INTERVAL_SECONDS, INTERVAL_SECONDS, dtype=np.int64)
    if expected.size != STEPS or not np.array_equal(index, expected):
        raise GeneratorError(f"{path}: timestamps are not the complete {YEAR} 15-minute UTC grid")

    return index, power_w


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------


def interval_energy_kwh(power_w: np.ndarray) -> np.ndarray:
    """Mean power (W) over 15 min → interval energy (kWh)."""
    return power_w.astype(np.float64) * TIME_STEP_HOURS / 1000.0


def berlin_months(index_unix: np.ndarray) -> np.ndarray:
    months = np.empty(index_unix.size, dtype=np.int16)
    for i, ts in enumerate(index_unix):
        months[i] = datetime.fromtimestamp(int(ts), tz=SEASONAL_TZ).month
    return months


def seasonal_shares(energy_kwh: np.ndarray, months: np.ndarray) -> dict[str, float]:
    total = float(np.sum(energy_kwh))
    if total <= 0.0:
        raise GeneratorError("seasonal shares: energy sum is not positive")
    out: dict[str, float] = {}
    for name, month_ids in SEASONS.items():
        mask = np.isin(months, month_ids)
        out[name] = float(np.sum(energy_kwh[mask]) / total)
    share_sum = math.fsum(out.values())
    if abs(share_sum - 1.0) > 1e-12:
        raise GeneratorError(f"seasonal shares sum to {share_sum!r}, expected 1.0")
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


def validate_profile(
    spec: ProfileSpec,
    energy_kwh: np.ndarray,
    weights: list[float],
    months: np.ndarray,
) -> dict[str, Any]:
    errors: list[str] = []
    weights_arr = np.asarray(weights, dtype=np.float64)

    if energy_kwh.size != STEPS or weights_arr.size != STEPS:
        errors.append(f"length {energy_kwh.size}/{weights_arr.size}, expected {STEPS}")
    if not np.isfinite(weights_arr).all() or not np.isfinite(energy_kwh).all():
        errors.append("non-finite values in energy or weights")
    if np.any(weights_arr < 0.0) or np.any(energy_kwh < 0.0):
        errors.append("negative values in energy or weights")

    weight_sum = math.fsum(float(x) for x in weights)
    if abs(weight_sum - 1.0) > SUM_TOLERANCE:
        errors.append(f"sum(weights)={weight_sum!r}, expected 1.0")

    annual = float(np.sum(energy_kwh))
    reconstructed = math.fsum(float(w) * annual for w in weights)
    if abs(reconstructed - annual) > ENERGY_TOLERANCE_KWH:
        errors.append(
            f"weights reconstruct {reconstructed} kWh, measured {annual} kWh"
        )

    annual_3dp = round(annual, 3)
    if annual_3dp != EXPECTED_ANNUAL_KWH_3DP:
        errors.append(
            f"measured annual {annual_3dp} kWh != inventory {EXPECTED_ANNUAL_KWH_3DP} kWh"
        )

    shares = seasonal_shares(energy_kwh, months)
    weight_shares = seasonal_shares(weights_arr, months)
    for season in SEASONS:
        if abs(weight_shares[season] - shares[season]) > 1e-10:
            errors.append(
                f"weight {season} share {weight_shares[season]} != energy {shares[season]}"
            )

    if errors:
        raise GeneratorError(
            f"{spec.profile_id} validation failed:\n  - " + "\n  - ".join(errors)
        )

    return {
        "measuredAnnualElectricalKwh": round(annual, ENERGY_DECIMALS),
        "weightSum": weight_sum,
        "reconstructedAnnualElectricalKwh": reconstructed,
        "seasonalShares": {k: round(v, SHARE_DECIMALS) for k, v in shares.items()},
        "weightSeasonalShares": {
            k: round(v, SHARE_DECIMALS) for k, v in weight_shares.items()
        },
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


def assert_metadata_complete(
    envelope: dict[str, Any],
    spec: ProfileSpec,
    *,
    methodology_source_id: str | None = None,
) -> None:
    expected_source = methodology_source_id or METHODOLOGY_SOURCE_ID
    required = SHARED_REQUIRED_ENVELOPE_KEYS + (
        "sourceDataset",
        "sourceBuilding",
        "sourceChannel",
    )
    missing = [k for k in required if k not in envelope or envelope[k] in (None, "")]
    if missing:
        raise GeneratorError(f"{spec.profile_id}: missing metadata {missing}")
    if envelope["schemaVersion"] != SCHEMA_VERSION:
        raise GeneratorError("schemaVersion mismatch")
    if envelope["profileId"] != spec.profile_id:
        raise GeneratorError("profileId mismatch")
    if envelope["steps"] != STEPS or len(envelope["weights"]) != STEPS:
        raise GeneratorError("steps/weights length mismatch")
    if envelope["technology"] != TECHNOLOGY:
        raise GeneratorError("technology mismatch")
    if envelope["dhwService"] != spec.dhw_service:
        raise GeneratorError("dhwService mismatch")
    if envelope["quality"] != QUALITY:
        raise GeneratorError("quality mismatch")
    if envelope["methodologySourceId"] != expected_source:
        raise GeneratorError("methodologySourceId mismatch")
    if envelope["license"] != LICENSE:
        raise GeneratorError("license mismatch")
    if not isinstance(envelope["calendarAlignment"], str) or not envelope[
        "calendarAlignment"
    ].strip():
        raise GeneratorError("calendarAlignment is empty")
    assert_seasonal_shares(envelope["seasonalShares"], spec)
    dumped = json.dumps(envelope, default=str)
    if "http://" in dumped or "https://" in dumped:
        raise GeneratorError("envelope must not embed URLs")


# ---------------------------------------------------------------------------
# Envelope I/O
# ---------------------------------------------------------------------------


def build_envelope(
    spec: ProfileSpec,
    weights: list[float],
    validation: dict[str, Any],
) -> dict[str, Any]:
    fill_summary: dict[str, Any] = {
        "nGapsRepaired": 0,
        "nSlotsFilled": 0,
        "addedElectricalKwh": 0.0,
        "rules": (
            "no research fill; COMPLETE 100% 2019 HDF5; "
            "publisher interpolation of gaps <=1 day may already be present"
        ),
        "gaps": [],
    }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "profileId": spec.profile_id,
        "technology": TECHNOLOGY,
        "dhwService": spec.dhw_service,
        "timeStepHours": TIME_STEP_HOURS,
        "steps": STEPS,
        "weights": list(weights),
        "measuredAnnualElectricalKwh": validation["measuredAnnualElectricalKwh"],
        "quality": QUALITY,
        "methodologySourceId": METHODOLOGY_SOURCE_ID,
        "license": LICENSE,
        "generatorVersion": GENERATOR_VERSION,
        "sourceWindow": SOURCE_WINDOW,
        "fillSummary": fill_summary,
        "sourceDataset": "WPuQ",
        "sourceBuilding": spec.source_building,
        "sourceChannel": CHANNEL,
        "sourceFile": SOURCE_FILE,
        "sourcePath": SOURCE_PATH,
        "calendarAlignment": (
            "native 2019 UTC 900 s grid, Europe/Berlin for seasonal metadata only"
        ),
        "seasonalShares": validation["weightSeasonalShares"],
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
    fill = data["fillSummary"]
    if fill["nGapsRepaired"] != 0 or fill["nSlotsFilled"] != 0:
        raise GeneratorError(f"{path.name}: unexpected research fill")
    if abs(float(fill["addedElectricalKwh"])) > ENERGY_TOLERANCE_KWH:
        raise GeneratorError(f"{path.name}: addedElectricalKwh is not zero")
    return {"reloadedWeightSum": weight_sum, "reloadedEnergyKwh": recon}


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def generate_one(h5_path: Path, spec: ProfileSpec) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    table = load_heatpump_table(h5_path, spec)
    index, power_w = extract_series(table, spec)
    energy = interval_energy_kwh(power_w)
    months = berlin_months(index)
    weights = unit_weights(energy)
    validation = validate_profile(spec, energy, weights, months)
    envelope = build_envelope(spec, weights, validation)
    assert_metadata_complete(envelope, spec)

    operating = power_w >= STANDBY_MAX_W
    stats = {
        "peakPowerW": float(np.max(power_w)),
        "operatingShare": float(np.mean(operating)),
        "nOperatingIntervals": int(np.sum(operating)),
        "standbyMaxW": STANDBY_MAX_W,
    }
    return envelope, validation, stats


def main() -> int:
    h5_path = RAW_DIR / SOURCE_FILE
    if not h5_path.is_file():
        raise GeneratorError(f"missing raw dataset: {h5_path}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    envelope, validation, stats = generate_one(h5_path, PROFILE)
    out_path = PROCESSED_DIR / PROFILE.filename
    write_envelope(out_path, envelope)
    written_check = validate_written_file(out_path, PROFILE)
    validation = {**validation, **written_check}

    print("WPuQ Wasser/Wasser production generator")
    print(f"  generatorVersion  {GENERATOR_VERSION}")
    print(f"  source            {SOURCE_FILE}")
    print(f"  path              {SOURCE_PATH}")
    print(f"  window            {SOURCE_WINDOW}")
    print(f"  steps             {STEPS}")
    print()
    fill = envelope["fillSummary"]
    print(PROFILE.filename)
    print(f"  profileId                       {envelope['profileId']}")
    print(f"  technology / dhwService         {envelope['technology']} / {envelope['dhwService']}")
    print(f"  sourceBuilding                  {envelope['sourceBuilding']}")
    print(f"  quality                         {envelope['quality']}")
    print(f"  license                         {envelope['license']}")
    print(f"  methodologySourceId             {envelope['methodologySourceId']}")
    print(
        f"  measuredAnnualElectricalKwh     {envelope['measuredAnnualElectricalKwh']}"
    )
    print(f"  peakPowerW                      {stats['peakPowerW']:.6f}")
    print(
        f"  operatingShare                  {stats['operatingShare']:.6f}  "
        f"(P >= {stats['standbyMaxW']:.0f} W, "
        f"{stats['nOperatingIntervals']}/{STEPS} intervals)"
    )
    print(f"  nGapsRepaired                   {fill['nGapsRepaired']}")
    print(f"  nSlotsFilled                    {fill['nSlotsFilled']}")
    print(f"  addedElectricalKwh              {fill['addedElectricalKwh']}")
    print("  seasonalShares (Europe/Berlin)")
    for season in ("winter", "spring", "summer", "autumn"):
        share = envelope["seasonalShares"][season]
        print(f"    {season:6s}  {share:.6f}  ({share * 100:.1f}%)")
    print(
        f"  validation  OK  "
        f"n={STEPS}  finite  >=0  "
        f"sum(weights)={validation['weightSum']!r}  "
        f"recon={validation['reconstructedAnnualElectricalKwh']} kWh  "
        f"reloaded={validation.get('reloadedWeightSum')!r}"
    )
    print()
    print("wrote:")
    print(f"  {out_path.relative_to(ROOT.parent.parent)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except GeneratorError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
