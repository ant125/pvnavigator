#!/usr/bin/env python3
"""Phase 3 research plots — production HP vs WPuQ 2019 usable HEATPUMP cohort."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
RESULTS = ROOT / "results" / "heatpump_validation"
PLOTS = RESULTS / "plots"
ARRAYS = ROOT / "processed" / "hp_phase3_arrays.npz"
SUMMARY = RESULTS / "summary.json"

STEPS_PER_DAY = 96
DT_H = 0.25

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import Normalize
except ImportError as exc:
    raise SystemExit("matplotlib required. pip install matplotlib") from exc


def load():
    if not ARRAYS.is_file():
        raise SystemExit(f"Missing {ARRAYS}; run run_phase3_hp_validation.py first")
    z = np.load(ARRAYS, allow_pickle=True)
    summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
    return z, summary


def style_ax(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(True, alpha=0.3)


def save(fig, name: str) -> None:
    PLOTS.mkdir(parents=True, exist_ok=True)
    path = PLOTS / name
    fig.tight_layout()
    fig.savefig(path, dpi=140)
    plt.close(fig)
    print(f"Wrote {path}")


def plot_monthly(z, n: int) -> None:
    months = np.arange(1, 13)
    mn = z["monthly_norm"]
    prod = z["prod_monthly"]
    med = np.median(mn, axis=0)
    p25 = np.percentile(mn, 25, axis=0)
    p75 = np.percentile(mn, 75, axis=0)
    fig, ax = plt.subplots(figsize=(9, 5))
    for i in range(n):
        ax.plot(months, mn[i], color="0.75", linewidth=0.8, alpha=0.55)
    ax.fill_between(months, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
    ax.plot(months, med, color="C0", linewidth=2.2, label="REAL median")
    ax.plot(months, prod, color="C3", linewidth=2.4, marker="o", label="Production model")
    ax.set_xticks(months)
    style_ax(
        ax,
        f"Monthly HP energy — normalized 4000 kWh (n={n})",
        "Month",
        "kWh / month",
    )
    ax.legend()
    save(fig, "monthly_comparison.png")


def plot_seasonal_bars(z, n: int) -> None:
    labels = ["Winter\nDJF", "Spring\nMAM", "Summer\nJJA", "Autumn\nSON"]
    idx = [(11, 0, 1), (2, 3, 4), (5, 6, 7), (8, 9, 10)]
    real = []
    prod = []
    p25s, p75s = [], []
    mn = z["monthly_norm"]
    pm = z["prod_monthly"]
    for triple in idx:
        s = mn[:, list(triple)].sum(axis=1) / 4000.0
        real.append(float(np.median(s)))
        p25s.append(float(np.percentile(s, 25)))
        p75s.append(float(np.percentile(s, 75)))
        prod.append(float(pm[list(triple)].sum() / 4000.0))
    x = np.arange(4)
    fig, ax = plt.subplots(figsize=(8, 4.8))
    yerr = np.vstack([np.array(real) - np.array(p25s), np.array(p75s) - np.array(real)])
    ax.bar(x - 0.18, real, 0.36, color="C0", yerr=yerr, capsize=4, label="REAL median")
    ax.bar(x + 0.18, prod, 0.36, color="C3", label="Production")
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    style_ax(ax, f"Seasonal energy share — 4000 kWh (n={n})", "", "Share of annual energy")
    ax.legend()
    save(fig, "seasonal_shares.png")


def plot_typical_season_days(z, n: int) -> None:
    seasons = (
        ("winter", "prod_season_winter", "season_winter", "Typical winter day (DJF mean)"),
        ("spring", "prod_season_spring", "season_spring", "Typical spring day (MAM mean)"),
        ("summer", "prod_season_summer", "season_summer", "Typical summer day (JJA mean)"),
        ("autumn", "prod_season_autumn", "season_autumn", "Typical autumn day (SON mean)"),
    )
    t = np.arange(STEPS_PER_DAY) / 4.0
    for name, pk, rk, title in seasons:
        real = z[rk]
        prod = z[pk]
        # kWh/interval → kW
        med = np.median(real, axis=0) / DT_H
        p25 = np.percentile(real, 25, axis=0) / DT_H
        p75 = np.percentile(real, 75, axis=0) / DT_H
        fig, ax = plt.subplots(figsize=(9, 4.6))
        for i in range(n):
            ax.plot(t, real[i] / DT_H, color="0.8", linewidth=0.6, alpha=0.45)
        ax.fill_between(t, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
        ax.plot(t, med, color="C0", linewidth=2.1, label="REAL median")
        ax.plot(t, prod / DT_H, color="C3", linewidth=2.3, label="Production")
        ax.set_xlim(0, 24)
        ax.set_xticks([0, 6, 12, 18, 24])
        style_ax(ax, f"{title} — 4000 kWh (n={n})", "Hour (Europe/Berlin)", "Average power (kW)")
        ax.legend(loc="upper right", fontsize=8)
        save(fig, f"typical_{name}_day.png")


def plot_calendar_days(z, n: int) -> None:
    mapping = (
        ("winter", "typical_winter", "typical_prod_winter", "2019-01-15"),
        ("spring", "typical_spring", "typical_prod_spring", "2019-04-15"),
        ("summer", "typical_summer", "typical_prod_summer", "2019-07-15"),
        ("autumn", "typical_autumn", "typical_prod_autumn", "2019-10-15"),
    )
    t = np.arange(STEPS_PER_DAY) / 4.0
    for season, rk, pk, iso in mapping:
        real = z[rk] / 1000.0
        prod = z[pk] / 1000.0
        med = np.median(real, axis=0)
        p25 = np.percentile(real, 25, axis=0)
        p75 = np.percentile(real, 75, axis=0)
        fig, ax = plt.subplots(figsize=(9, 4.6))
        for i in range(n):
            ax.plot(t, real[i], color="0.8", linewidth=0.6, alpha=0.4)
        ax.fill_between(t, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
        ax.plot(t, med, color="C0", linewidth=2.0, label="REAL median")
        ax.plot(t, prod, color="C3", linewidth=2.3, label="Production")
        ax.set_xlim(0, 24)
        style_ax(
            ax,
            f"{iso} ({season}) — normalized 4000 kWh (n={n})",
            "Hour (Europe/Berlin)",
            "15-min mean power (kW)",
        )
        ax.legend(fontsize=8)
        save(fig, f"calendar_{season}_day.png")


def plot_daily_duration(z, n: int) -> None:
    sd = z["sort_daily"]
    prod = z["prod_daily_sorted"]
    ranks = np.arange(1, sd.shape[1] + 1)
    med = np.median(sd, axis=0)
    p25 = np.percentile(sd, 25, axis=0)
    p75 = np.percentile(sd, 75, axis=0)
    fig, ax = plt.subplots(figsize=(8.5, 5))
    for i in range(n):
        ax.plot(ranks, sd[i], color="0.8", linewidth=0.6, alpha=0.45)
    ax.fill_between(ranks, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
    ax.plot(ranks, med, color="C0", linewidth=2.1, label="REAL median")
    ax.plot(ranks, prod, color="C3", linewidth=2.3, label="Production")
    style_ax(
        ax,
        f"Daily energy duration curve — 4000 kWh (n={n})",
        "Day rank (highest daily kWh first)",
        "Daily HP energy (kWh)",
    )
    ax.legend()
    save(fig, "daily_duration_curve.png")


def plot_load_duration(z, n: int) -> None:
    sp = z["sort_power"] / 1000.0
    prod = z["prod_ldc"] / 1000.0
    hours = np.arange(sp.shape[1]) * DT_H
    med = np.median(sp, axis=0)
    p25 = np.percentile(sp, 25, axis=0)
    p75 = np.percentile(sp, 75, axis=0)
    fig, ax = plt.subplots(figsize=(8.5, 5))
    for i in range(n):
        ax.plot(hours, sp[i], color="0.8", linewidth=0.5, alpha=0.4)
    ax.fill_between(hours, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
    ax.plot(hours, med, color="C0", linewidth=2.0, label="REAL median")
    ax.plot(hours, prod, color="C3", linewidth=2.3, label="Production")
    style_ax(
        ax,
        f"Load duration curve — 15-min mean power, 4000 kWh (n={n})",
        "Hours at or above this power",
        "Power (kW)",
    )
    ax.set_xlim(0, 8760)
    ax.legend()
    save(fig, "load_duration_curve.png")


def plot_power_histogram(z, n: int) -> None:
    # Normalized operating-ish power; clip display at 8 kW
    power = z["norm_power"].ravel() / 1000.0
    prod = z["prod_p"] / 1000.0
    fig, ax = plt.subplots(figsize=(8.5, 5))
    bins = np.linspace(0, 8, 81)
    ax.hist(
        power[power > 0],
        bins=bins,
        density=True,
        color="C0",
        alpha=0.55,
        label="REAL intervals (all houses)",
    )
    ax.hist(
        prod,
        bins=bins,
        density=True,
        color="C3",
        alpha=0.55,
        histtype="step",
        linewidth=2.2,
        label="Production",
    )
    ax.axvline(0.1, color="0.4", linestyle="--", linewidth=1, label="Standby 100 W")
    ax.axvline(4.0, color="0.2", linestyle=":", linewidth=1.2, label="Rod threshold 4 kW")
    style_ax(
        ax,
        f"Power histogram — normalized 4000 kWh (n={n})",
        "15-min mean power (kW)",
        "Density",
    )
    ax.legend(fontsize=8)
    save(fig, "power_histogram.png")


def plot_operating_histogram(z, n: int) -> None:
    power_w = z["norm_power"]
    standby = 100.0
    op = power_w[power_w >= standby] / 1000.0
    prod = z["prod_p"]
    prod_op = prod[prod >= standby] / 1000.0
    fig, ax = plt.subplots(figsize=(8.5, 5))
    bins = np.linspace(0.1, 8, 80)
    ax.hist(op, bins=bins, density=True, color="C0", alpha=0.55, label="REAL operating intervals")
    if prod_op.size:
        ax.hist(
            prod_op,
            bins=bins,
            density=True,
            color="C3",
            alpha=0.7,
            histtype="step",
            linewidth=2.2,
            label="Production (all intervals ≥100 W)",
        )
    ax.axvline(4.0, color="0.2", linestyle=":", linewidth=1.2, label="Rod 4 kW")
    style_ax(
        ax,
        f"Operating-power histogram (≥100 W), 4000 kWh (n={n})",
        "15-min mean power (kW)",
        "Density",
    )
    ax.legend(fontsize=8)
    save(fig, "operating_histogram.png")


def plot_hourly(z, n: int) -> None:
    hs = z["hourly_share"]
    prod = z["prod_hourly"]
    hours = np.arange(24)
    med = np.median(hs, axis=0)
    p25 = np.percentile(hs, 25, axis=0)
    p75 = np.percentile(hs, 75, axis=0)
    fig, ax = plt.subplots(figsize=(9, 4.8))
    for i in range(n):
        ax.plot(hours, hs[i], color="0.8", linewidth=0.7, alpha=0.5)
    ax.fill_between(hours, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
    ax.plot(hours, med, color="C0", linewidth=2.1, label="REAL median")
    ax.plot(hours, prod, color="C3", linewidth=2.3, marker="o", markersize=3, label="Production")
    ax.set_xticks(range(0, 24, 2))
    style_ax(
        ax,
        f"Hour-of-day energy share — 4000 kWh (n={n})",
        "Hour (Europe/Berlin)",
        "Share of annual HP energy",
    )
    ax.legend()
    save(fig, "hourly_distribution.png")


def plot_weekday_weekend(z, n: int) -> None:
    daily = z["daily_norm"]
    weekdays = z["weekdays_by_day"]
    wd_mask = weekdays < 5
    means_wd = daily[:, wd_mask].mean(axis=1)
    means_we = daily[:, ~wd_mask].mean(axis=1)
    prod_d = z["prod_daily"]
    prod_wd = float(prod_d[wd_mask].mean())
    prod_we = float(prod_d[~wd_mask].mean())
    fig, ax = plt.subplots(figsize=(6.8, 5))
    ax.scatter(means_wd, means_we, color="C0", alpha=0.75, label="REAL houses")
    ax.scatter([prod_wd], [prod_we], color="C3", s=80, zorder=3, label="Production")
    lims = [
        0,
        max(means_wd.max(), means_we.max(), prod_wd, prod_we) * 1.08,
    ]
    ax.plot(lims, lims, color="0.5", linestyle="--", linewidth=1, label="weekday = weekend")
    ax.set_xlim(lims)
    ax.set_ylim(lims)
    style_ax(
        ax,
        f"Weekday vs weekend mean daily kWh (n={n})",
        "Weekday mean daily kWh",
        "Weekend mean daily kWh",
    )
    ax.legend(fontsize=8)
    save(fig, "weekday_weekend.png")


def plot_cumulative(z, n: int) -> None:
    ce = z["cum_energy"]
    prod = z["prod_cum"]
    days = np.arange(ce.shape[1]) / STEPS_PER_DAY
    med = np.median(ce, axis=0)
    p25 = np.percentile(ce, 25, axis=0)
    p75 = np.percentile(ce, 75, axis=0)
    fig, ax = plt.subplots(figsize=(8.5, 5))
    for i in range(n):
        ax.plot(days, ce[i], color="0.8", linewidth=0.5, alpha=0.4)
    ax.fill_between(days, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
    ax.plot(days, med, color="C0", linewidth=2.0, label="REAL median")
    ax.plot(days, prod, color="C3", linewidth=2.3, label="Production")
    style_ax(
        ax,
        f"Cumulative HP energy vs calendar — 4000 kWh (n={n})",
        "Day of year",
        "Cumulative energy (kWh)",
    )
    ax.legend()
    save(fig, "cumulative_energy_calendar.png")

    cs = z["cum_sorted_e"]
    pcs = z["prod_cum_sorted"]
    frac = np.arange(1, cs.shape[1] + 1) / cs.shape[1]
    med = np.median(cs, axis=0)
    p25 = np.percentile(cs, 25, axis=0)
    p75 = np.percentile(cs, 75, axis=0)
    fig, ax = plt.subplots(figsize=(8.5, 5))
    for i in range(n):
        ax.plot(frac, cs[i], color="0.8", linewidth=0.5, alpha=0.4)
    ax.fill_between(frac, p25, p75, color="C0", alpha=0.28, label="REAL P25–P75")
    ax.plot(frac, med, color="C0", linewidth=2.0, label="REAL median")
    ax.plot(frac, pcs, color="C3", linewidth=2.3, label="Production")
    ax.plot([0, 1], [0, 1], color="0.5", linestyle="--", linewidth=1, label="uniform")
    style_ax(
        ax,
        f"Cumulative energy vs duration (sorted intervals) — n={n}",
        "Fraction of year (highest-energy intervals first)",
        "Fraction of annual energy",
    )
    ax.legend(fontsize=8)
    save(fig, "cumulative_energy_duration.png")


def heatmap_from_power(power_w: np.ndarray, doy: np.ndarray, hours: np.ndarray) -> np.ndarray:
    """365 x 24 mean kW using local day-of-year and local hour."""
    acc = np.zeros((365, 24), dtype=np.float64)
    cnt = np.zeros((365, 24), dtype=np.float64)
    kw = power_w / 1000.0
    for i in range(power_w.shape[0]):
        d = int(doy[i])
        h = int(hours[i])
        if 0 <= d < 365 and 0 <= h < 24:
            acc[d, h] += kw[i]
            cnt[d, h] += 1.0
    return np.divide(acc, cnt, out=np.zeros_like(acc), where=cnt > 0)


def plot_heatmaps(z, summary: dict) -> None:
    doy = z["doy"]
    hours = z["hours"]
    prod = heatmap_from_power(z["prod_p"], doy, hours)
    hp = z["norm_power"]
    maps = np.stack(
        [heatmap_from_power(hp[i], doy, hours) for i in range(hp.shape[0])], axis=0
    )
    med = np.median(maps, axis=0)
    vmax = float(np.percentile(med, 99))
    vmax = max(vmax, float(prod.max()) * 1.05, 0.5)

    norm = Normalize(vmin=0, vmax=vmax)
    fig, axes = plt.subplots(1, 2, figsize=(12.5, 5.2), sharey=True, layout="constrained")
    im0 = axes[0].imshow(
        med.T,
        aspect="auto",
        origin="lower",
        cmap="YlOrRd",
        norm=norm,
        extent=[1, 365, 0, 24],
    )
    axes[0].set_title("REAL median house-heatmap (4000 kWh)")
    axes[0].set_xlabel("Day of year")
    axes[0].set_ylabel("Hour (Europe/Berlin)")
    axes[1].imshow(
        prod.T,
        aspect="auto",
        origin="lower",
        cmap="YlOrRd",
        norm=norm,
        extent=[1, 365, 0, 24],
    )
    axes[1].set_title("Production model (4000 kWh)")
    axes[1].set_xlabel("Day of year")
    fig.colorbar(im0, ax=axes, fraction=0.025, pad=0.02, label="kW")
    PLOTS.mkdir(parents=True, exist_ok=True)
    path = PLOTS / "heatmap_median_vs_production.png"
    fig.savefig(path, dpi=140)
    plt.close(fig)
    print(f"Wrote {path}")

    rid = int(z["representative_idx"])
    hid = summary["representative"]["house_id"]
    fig, axes = plt.subplots(1, 2, figsize=(12.5, 5.2), sharey=True, layout="constrained")
    imr = axes[0].imshow(
        maps[rid].T,
        aspect="auto",
        origin="lower",
        cmap="YlOrRd",
        norm=norm,
        extent=[1, 365, 0, 24],
    )
    axes[0].set_title(f"Representative {hid} (4000 kWh)")
    axes[0].set_xlabel("Day of year")
    axes[0].set_ylabel("Hour (Europe/Berlin)")
    axes[1].imshow(
        prod.T,
        aspect="auto",
        origin="lower",
        cmap="YlOrRd",
        norm=norm,
        extent=[1, 365, 0, 24],
    )
    axes[1].set_title("Production model (4000 kWh)")
    axes[1].set_xlabel("Day of year")
    fig.colorbar(imr, ax=axes, fraction=0.025, pad=0.02, label="kW")
    path = PLOTS / "heatmap_representative_vs_production.png"
    fig.savefig(path, dpi=140)
    plt.close(fig)
    print(f"Wrote {path}")


def plot_annual_hist(z, summary: dict) -> None:
    ann = z["measured_annual"]
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    ax.hist(ann, bins=10, color="C0", edgecolor="white")
    ax.axvline(4000, color="C3", linewidth=2, label="Normalization target 4000 kWh")
    ax.axvline(float(np.median(ann)), color="C1", linewidth=2, linestyle="--", label="Cohort median")
    style_ax(
        ax,
        f"Measured 2019 HP annual energy (n={ann.size})",
        "kWh / year",
        "Houses",
    )
    ax.legend(fontsize=8)
    save(fig, "measured_annual_kwh.png")


def main() -> int:
    z, summary = load()
    n = int(z["house_ids"].shape[0])
    PLOTS.mkdir(parents=True, exist_ok=True)
    plot_monthly(z, n)
    plot_seasonal_bars(z, n)
    plot_typical_season_days(z, n)
    plot_calendar_days(z, n)
    plot_daily_duration(z, n)
    plot_load_duration(z, n)
    plot_power_histogram(z, n)
    plot_operating_histogram(z, n)
    plot_hourly(z, n)
    plot_weekday_weekend(z, n)
    plot_cumulative(z, n)
    plot_heatmaps(z, summary)
    plot_annual_hist(z, summary)
    print(f"Plots in {PLOTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
