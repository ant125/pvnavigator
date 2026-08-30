#!/usr/bin/env python3
"""Phase 2 research plots from bdew_vs_real_2019_detail.csv."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
RESULTS = ROOT / "results"
PLOTS = RESULTS / "plots"
PROCESSED = ROOT / "processed"

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError as exc:
    raise SystemExit(
        "matplotlib required for Phase 2 plots. "
        "pip install matplotlib"
    ) from exc


def load_detail():
    import csv

    rows = []
    with (RESULTS / "bdew_vs_real_2019_detail.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(row)
    return rows


def to_f(v: str) -> float:
    return float(v)


def band_stats(values_by_size: dict[float, list[float]]):
    sizes = sorted(values_by_size)
    med, p25, p75 = [], [], []
    for s in sizes:
        arr = np.asarray(values_by_size[s], dtype=float)
        med.append(float(np.median(arr)))
        p25.append(float(np.percentile(arr, 25)))
        p75.append(float(np.percentile(arr, 75)))
    return sizes, med, p25, p75


def plot_metric_vs_battery(rows, metric_key: str, ylabel: str, outfile: str):
    real_by_size: dict[float, list[float]] = {}
    bdew = {}
    house_series: dict[str, list[tuple[float, float]]] = {}

    for r in rows:
        size = to_f(r["battery_kwh"])
        val = to_f(r[metric_key])
        if r["profile_type"] == "BDEW":
            bdew[size] = val
        else:
            real_by_size.setdefault(size, []).append(val)
            house_series.setdefault(r["profile_id"], []).append((size, val))

    sizes, med, p25, p75 = band_stats(real_by_size)
    fig, ax = plt.subplots(figsize=(8, 5))
    for hid, pts in house_series.items():
        pts = sorted(pts)
        ax.plot(
            [p[0] for p in pts],
            [p[1] for p in pts],
            color="0.75",
            linewidth=0.7,
            alpha=0.6,
        )
    ax.fill_between(sizes, p25, p75, color="C0", alpha=0.25, label="REAL P25–P75")
    ax.plot(sizes, med, color="C0", linewidth=2, label="REAL median")
    bdew_sizes = sorted(bdew)
    ax.plot(
        bdew_sizes,
        [bdew[s] for s in bdew_sizes],
        color="C3",
        linewidth=2.5,
        marker="o",
        markersize=3,
        label="BDEW H25",
    )
    ax.set_xlabel("Battery capacity (kWh)")
    ax.set_ylabel(ylabel)
    ax.set_title(f"{ylabel} vs battery — WPuQ 2019 NO_PV COMPLETE (n={len(house_series)})")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(PLOTS / outfile, dpi=140)
    plt.close(fig)
    print(f"Wrote {PLOTS / outfile}")


def plot_grenze_hist(rows):
    grenze = {}
    for r in rows:
        if r["profile_type"] != "REAL":
            continue
        grenze[r["profile_id"]] = to_f(r["technical_speichergrenze_kwh"])
    vals = list(grenze.values())
    bdew = next(
        to_f(r["technical_speichergrenze_kwh"])
        for r in rows
        if r["profile_type"] == "BDEW"
    )
    fig, ax = plt.subplots(figsize=(7, 4.5))
    bins = np.arange(min(vals) - 0.5, max(vals) + 1.5, 1)
    ax.hist(vals, bins=bins, color="C0", edgecolor="white", label="REAL houses")
    ax.axvline(bdew, color="C3", linewidth=2, label=f"BDEW ({bdew:.0f} kWh)")
    ax.set_xlabel("Technical Speichergrenze (kWh)")
    ax.set_ylabel("House count")
    ax.set_title("Distribution of technical Speichergrenze — WPuQ 2019 cohort")
    ax.legend()
    ax.grid(True, axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS / "technical_speichergrenze_hist.png", dpi=140)
    plt.close(fig)
    print(f"Wrote {PLOTS / 'technical_speichergrenze_hist.png'}")


def plot_load_shapes():
    rep_path = RESULTS / "representative_profiles.json"
    if not rep_path.is_file():
        print("Skip load-shape plot: missing representative_profiles.json")
        return
    rep = json.loads(rep_path.read_text(encoding="utf-8"))
    houses = [
        rep["lowest_autarkie_at_10kwh"]["house_id"],
        rep["closest_to_median_autarkie_at_10kwh"]["house_id"],
        rep["highest_autarkie_at_10kwh"]["house_id"],
    ]
    weeks = {
        "winter_week_jan": (14 * 96, 21 * 96),
        "summer_week_jul": (196 * 96, 203 * 96),
    }

    bdew_path = PROCESSED / "bdew_h25_5000_2019.json"
    if not bdew_path.is_file():
        print("Skip load-shape plot: missing bdew_h25_5000_2019.json (write from TS)")
        return

    bdew = np.asarray(
        json.loads(bdew_path.read_text(encoding="utf-8"))["interval_energy_kwh"],
        dtype=float,
    )

    for week_name, (a, b) in weeks.items():
        fig, ax = plt.subplots(figsize=(10, 4.5))
        x = np.arange(b - a) / 96.0  # days
        ax.plot(x, bdew[a:b] * 4, color="C3", linewidth=2, label="BDEW H25")  # → kW avg
        colors = ["C0", "C2", "C1"]
        labels = ["low-autarkie", "median-like", "high-autarkie"]
        for hid, color, lab in zip(houses, colors, labels):
            p = PROCESSED / "profiles_2019_normalized" / f"{hid}.json"
            arr = np.asarray(
                json.loads(p.read_text(encoding="utf-8"))["interval_energy_kwh"],
                dtype=float,
            )
            ax.plot(x, arr[a:b] * 4, color=color, linewidth=1.4, alpha=0.9, label=f"{hid} ({lab})")
        ax.set_xlabel("Day within week")
        ax.set_ylabel("Average power (kW)")
        ax.set_title(f"Normalized 5000 kWh household load — {week_name.replace('_', ' ')}")
        ax.grid(True, alpha=0.3)
        ax.legend(fontsize=8)
        fig.tight_layout()
        out = PLOTS / f"load_shape_{week_name}.png"
        fig.savefig(out, dpi=140)
        plt.close(fig)
        print(f"Wrote {out}")


def main() -> int:
    PLOTS.mkdir(parents=True, exist_ok=True)
    rows = load_detail()
    plot_metric_vs_battery(rows, "autarkie_pct", "Autarkie (%)", "autarkie_vs_battery.png")
    plot_metric_vs_battery(
        rows,
        "eigenverbrauchsquote_pct",
        "Eigenverbrauchsquote (%)",
        "eigenverbrauchsquote_vs_battery.png",
    )
    plot_metric_vs_battery(rows, "netzbezug_kwh", "Netzbezug (kWh/a)", "netzbezug_vs_battery.png")
    plot_grenze_hist(rows)
    plot_load_shapes()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
