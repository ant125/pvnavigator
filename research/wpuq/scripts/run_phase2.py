#!/usr/bin/env python3
"""Run WPuQ Phase 2 pipeline (cohort → HP stats → TS benchmark → plots).

Requires:
  - Phase 1 inventory already present
  - Python venv with h5py/numpy/matplotlib
  - npx tsx for the TypeScript kernel benchmark (network for one PVGIS fetch)
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
SCRIPTS = Path(__file__).resolve().parent


def run(cmd: list[str], cwd: Path | None = None) -> None:
    print(f"\n$ {' '.join(cmd)}")
    subprocess.check_call(cmd, cwd=str(cwd or REPO))


def main() -> int:
    py = sys.executable
    run([py, str(SCRIPTS / "build_benchmark_cohort.py")])
    run([py, str(SCRIPTS / "heatpump_2019_stats.py")])

    npx = shutil.which("npx")
    if not npx:
        raise SystemExit("npx not found; install Node.js to run the TS benchmark")
    run(
        [
            npx,
            "tsx",
            "--tsconfig",
            "apps/speicher-physik/tsconfig.json",
            "research/wpuq/scripts/run_bdew_vs_real_benchmark.ts",
        ]
    )
    run([py, str(SCRIPTS / "plot_phase2.py")])
    print("\nPhase 2 complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
