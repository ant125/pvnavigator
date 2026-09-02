#!/usr/bin/env python3
"""WPuQ Wasser/Wasser robustness-pack generator.

The generator is the only place that interprets the WPuQ HDF5 files.
Runtime code must never read the HDF5; it consumes the JSON assets written
to research/wpuq/processed/robustness/.

These houses are research robustness assets only. They are not production
catalogue rows. Do not copy them into packages/heatpump-profile.

Profile ids here keep the research robustness grammar
(`ww-wpuq-2019-sfh{nn}-v1`). That is not the production heat-pump grammar
(`{tech}-{dhw}-{dataset}-{optionalYear}-{building}-v{n}`).

Quality is currently written as `field-cohort-representative` because the
shared production generator exports that string. That label must not be
reused as a future catalogue quality for these houses without explicit
review. The production representative is a separate, selected series.

Each approved house is an independent measured series. This script does not
average, cluster, synthesise, or choose a default.

Pipeline (deterministic, per house):

  2019 HDF5  →  extract {NO_PV|WITH_PV}/SFHn/HEATPUMP/P_TOT
             →  validate complete 15-min 2019 year
             →  W → interval kWh  →  unit-normalise
             →  validate  →  write one JSON envelope

Household meters are never read. HEATPUMP/P_TOT is the dedicated HP channel
even when the house sits in WITH_PV (rooftop PV contaminates HOUSEHOLD only).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import h5py
import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from generate_heatpump_production_profile import (  # noqa: E402
    CHANNEL,
    DHW_SERVICE,
    ENERGY_DECIMALS,
    ENERGY_TOLERANCE_KWH,
    FEED,
    GENERATOR_VERSION,
    LICENSE,
    QUALITY,
    RAW_DIR,
    SCHEMA_VERSION,
    SOURCE_FILE,
    SOURCE_WINDOW,
    STANDBY_MAX_W,
    STEPS,
    SUM_TOLERANCE,
    TECHNOLOGY,
    TIME_STEP_HOURS,
    YEAR,
    GeneratorError,
    ProfileSpec,
    assert_metadata_complete,
    berlin_months,
    extract_series,
    interval_energy_kwh,
    seasonal_shares,
    unit_weights,
    write_envelope,
)

ROOT = SCRIPT_DIR.parent
PROCESSED_DIR = ROOT / "processed"
ROBUSTNESS_DIR = PROCESSED_DIR / "robustness"

# Household-robustness methodology id. Not the production WW heat-pump source.
ROBUSTNESS_METHODOLOGY_SOURCE_ID = "wpuq-scientific-data"

# Approved independent measured houses. Do not add excluded buildings.
APPROVED_HOUSE_IDS: tuple[str, ...] = (
    "SFH3",
    "SFH4",
    "SFH7",
    "SFH8",
    "SFH9",
    "SFH10",
    "SFH11",
    "SFH12",
    "SFH15",
    "SFH16",
    "SFH18",
    "SFH19",
    "SFH23",
    "SFH26",
    "SFH27",
    "SFH28",
    "SFH29",
    "SFH30",
    "SFH32",
    "SFH33",
    "SFH35",
    "SFH36",
    "SFH38",
    "SFH39",
)

EXCLUDED_HOUSE_IDS: frozenset[str] = frozenset(
    {"SFH5", "SFH14", "SFH20", "SFH21", "SFH22", "SFH34"}
)

CALENDAR_ALIGNMENT = (
    "native 2019 UTC 900 s grid, Europe/Berlin for seasonal metadata only"
)
FILL_RULES = (
    "no research fill; COMPLETE 100% 2019 HDF5; "
    "publisher interpolation of gaps <=1 day may already be present"
)


def house_number(house_id: str) -> int:
    if not house_id.startswith("SFH"):
        raise GeneratorError(f"unexpected house id {house_id!r}")
    return int(house_id[3:])


def profile_id_for(house_id: str) -> str:
    return f"ww-wpuq-2019-sfh{house_number(house_id):02d}-v1"


def filename_for(house_id: str) -> str:
    return f"{profile_id_for(house_id)}.json"


def dataset_path(pv_group: str, house_id: str) -> str:
    return f"{pv_group}/{house_id}/{FEED}/table"


def resolve_pv_group(h5: h5py.File, house_id: str) -> str:
    """Prefer NO_PV. WITH_PV is allowed only for the dedicated HEATPUMP feed."""
    no_pv = dataset_path("NO_PV", house_id)
    with_pv = dataset_path("WITH_PV", house_id)
    if no_pv in h5:
        return "NO_PV"
    if with_pv in h5:
        return "WITH_PV"
    raise GeneratorError(
        f"{house_id}: missing {FEED}/{CHANNEL} under NO_PV and WITH_PV"
    )


def load_heatpump_table(h5: h5py.File, spec: ProfileSpec) -> np.ndarray:
    path = dataset_path(spec.pv_group, spec.house_id)
    if path not in h5:
        raise GeneratorError(f"missing dataset {path}")
    table = h5[path][:]
    names = table.dtype.names or ()
    if "index" not in names:
        raise GeneratorError(f"{path}: missing index column")
    if CHANNEL not in names:
        raise GeneratorError(f"{path}: missing power column {CHANNEL!r}")
    if "HOUSEHOLD" in path:
        raise GeneratorError(f"{path}: household meter is forbidden")
    return table


def validate_converted(
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

    shares = seasonal_shares(energy_kwh, months)
    weight_shares = seasonal_shares(weights_arr, months)
    for season in ("winter", "spring", "summer", "autumn"):
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
        "seasonalShares": {k: round(v, 6) for k, v in shares.items()},
        "weightSeasonalShares": {k: round(v, 6) for k, v in weight_shares.items()},
    }


def build_envelope(
    spec: ProfileSpec,
    weights: list[float],
    validation: dict[str, Any],
) -> dict[str, Any]:
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
        "methodologySourceId": ROBUSTNESS_METHODOLOGY_SOURCE_ID,
        "license": LICENSE,
        "generatorVersion": GENERATOR_VERSION,
        "sourceWindow": SOURCE_WINDOW,
        "fillSummary": {
            "nGapsRepaired": 0,
            "nSlotsFilled": 0,
            "addedElectricalKwh": 0.0,
            "rules": FILL_RULES,
            "gaps": [],
        },
        "sourceDataset": "WPuQ",
        "sourceBuilding": spec.source_building,
        "sourceChannel": CHANNEL,
        "sourceFile": SOURCE_FILE,
        "sourcePath": dataset_path(spec.pv_group, spec.house_id),
        "calendarAlignment": CALENDAR_ALIGNMENT,
        "seasonalShares": validation["weightSeasonalShares"],
    }


def validate_written_file(path: Path, spec: ProfileSpec) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if "http://" in text or "https://" in text:
        raise GeneratorError(f"{path.name}: written JSON embeds a URL")
    data = json.loads(text)
    assert_metadata_complete(
        data, spec, methodology_source_id=ROBUSTNESS_METHODOLOGY_SOURCE_ID
    )
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
    if data["sourceBuilding"] != spec.house_id:
        raise GeneratorError(f"{path.name}: sourceBuilding is not this house")
    return {"reloadedWeightSum": weight_sum, "reloadedEnergyKwh": recon}


def generate_one(
    h5: h5py.File,
    spec: ProfileSpec,
    months: np.ndarray | None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], np.ndarray]:
    table = load_heatpump_table(h5, spec)
    index, power_w = extract_series(table, spec)
    energy = interval_energy_kwh(power_w)
    house_months = berlin_months(index) if months is None else months
    weights = unit_weights(energy)
    validation = validate_converted(spec, energy, weights, house_months)
    envelope = build_envelope(spec, weights, validation)
    assert_metadata_complete(
        envelope, spec, methodology_source_id=ROBUSTNESS_METHODOLOGY_SOURCE_ID
    )

    operating = power_w >= STANDBY_MAX_W
    stats = {
        "peakPower": float(np.max(power_w)),
        "operatingShare": float(np.mean(operating)),
        "nOperatingIntervals": int(np.sum(operating)),
    }
    return envelope, validation, stats, house_months


def build_index_record(
    spec: ProfileSpec,
    envelope: dict[str, Any],
    stats: dict[str, Any],
) -> dict[str, Any]:
    shares = envelope["seasonalShares"]
    return {
        "houseId": spec.house_id,
        "profileId": envelope["profileId"],
        "annualElectricalKwh": envelope["measuredAnnualElectricalKwh"],
        "winterShare": shares["winter"],
        "summerShare": shares["summer"],
        "peakPower": stats["peakPower"],
        "operatingShare": stats["operatingShare"],
        "quality": envelope["quality"],
    }


def main() -> int:
    if EXCLUDED_HOUSE_IDS.intersection(APPROVED_HOUSE_IDS):
        raise GeneratorError("approved list overlaps the exclusion list")
    if len(set(APPROVED_HOUSE_IDS)) != len(APPROVED_HOUSE_IDS):
        raise GeneratorError("approved list contains duplicates")

    h5_path = RAW_DIR / SOURCE_FILE
    if not h5_path.is_file():
        raise GeneratorError(f"missing raw dataset: {h5_path}")

    generated: list[tuple[ProfileSpec, dict[str, Any], dict[str, Any], dict[str, Any]]] = []
    months: np.ndarray | None = None

    with h5py.File(h5_path, "r") as h5:
        for house_id in APPROVED_HOUSE_IDS:
            if house_id in EXCLUDED_HOUSE_IDS:
                raise GeneratorError(f"{house_id} is excluded and must not be generated")
            pv_group = resolve_pv_group(h5, house_id)
            spec = ProfileSpec(
                profile_id=profile_id_for(house_id),
                filename=filename_for(house_id),
                house_id=house_id,
                pv_group=pv_group,
                year=YEAR,
                dhw_service=DHW_SERVICE,
                source_building=house_id,
            )
            envelope, validation, stats, months = generate_one(h5, spec, months)
            generated.append((spec, envelope, validation, stats))

    ROBUSTNESS_DIR.mkdir(parents=True, exist_ok=True)

    index_houses: list[dict[str, Any]] = []
    written: list[Path] = []
    for spec, envelope, validation, stats in generated:
        out_path = ROBUSTNESS_DIR / spec.filename
        write_envelope(out_path, envelope)
        written_check = validate_written_file(out_path, spec)
        validation.update(written_check)
        index_houses.append(build_index_record(spec, envelope, stats))
        written.append(out_path)

    unexpected = sorted(
        p.name
        for p in ROBUSTNESS_DIR.glob("ww-wpuq-2019-sfh*.json")
        if p.name not in {spec.filename for spec, *_ in generated}
    )
    if unexpected:
        raise GeneratorError(f"unexpected robustness files: {unexpected}")

    index_payload = {
        "nHouses": len(index_houses),
        "independentMeasuredHouses": True,
        "averaged": False,
        "clustered": False,
        "synthetic": False,
        "sourceWindow": SOURCE_WINDOW,
        "generatorVersion": GENERATOR_VERSION,
        "houses": index_houses,
    }
    index_text = json.dumps(index_payload, indent=2, ensure_ascii=True)
    if not index_text.endswith("\n"):
        index_text += "\n"
    if "http://" in index_text or "https://" in index_text:
        raise GeneratorError("index.json must not embed URLs")
    index_path = ROBUSTNESS_DIR / "index.json"
    index_path.write_text(index_text, encoding="utf-8")

    annuals = [row["annualElectricalKwh"] for row in index_houses]
    winters = [row["winterShare"] for row in index_houses]
    summers = [row["summerShare"] for row in index_houses]
    peaks = [row["peakPower"] for row in index_houses]
    ops = [row["operatingShare"] for row in index_houses]

    print("WPuQ Wasser/Wasser robustness pack")
    print(f"  generatorVersion  {GENERATOR_VERSION}")
    print(f"  source            {SOURCE_FILE}")
    print(f"  window            {SOURCE_WINDOW}")
    print(f"  houses            {len(index_houses)} independent measured series")
    print(f"  steps             {STEPS}")
    print()
    print(
        f"{'house':6}  {'profileId':26}  {'kWh':10}  "
        f"{'winter':7}  {'summer':7}  {'peakW':10}  {'opShare':7}  pv"
    )
    for (spec, envelope, validation, stats), row in zip(generated, index_houses):
        print(
            f"{spec.house_id:6}  {row['profileId']:26}  "
            f"{row['annualElectricalKwh']:10.3f}  "
            f"{row['winterShare']:7.4f}  {row['summerShare']:7.4f}  "
            f"{row['peakPower']:10.1f}  {row['operatingShare']:7.4f}  "
            f"{spec.pv_group}"
        )
        if abs(validation["weightSum"] - 1.0) > SUM_TOLERANCE:
            raise GeneratorError(f"{spec.profile_id}: weight sum drifted after write")
    print()
    print("validation  OK  every profile: n=35040  finite  >=0  sum(weights)=1  recon")
    print(
        f"  annual kWh     {min(annuals):.3f} … {max(annuals):.3f}"
    )
    print(
        f"  winter share   {min(winters):.4f} … {max(winters):.4f}"
    )
    print(
        f"  summer share   {min(summers):.4f} … {max(summers):.4f}"
    )
    print(
        f"  peak power W   {min(peaks):.1f} … {max(peaks):.1f}"
    )
    print(
        f"  operatingShare {min(ops):.4f} … {max(ops):.4f}"
    )
    print()
    print("wrote:")
    repo = ROOT.parent.parent
    for path in written:
        print(f"  {path.relative_to(repo)}")
    print(f"  {index_path.relative_to(repo)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except GeneratorError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
