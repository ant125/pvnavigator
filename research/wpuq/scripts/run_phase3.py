#!/usr/bin/env python3
"""Run WPuQ Phase 3 heat-pump validation pipeline (research only).

Does not modify production. Does not commit.

Requires:
  - Phase 1 inventory
  - 2019 HDF5 in research/wpuq/raw/
  - Python venv with h5py/numpy/matplotlib
  - npx tsx to export unmodified createHeatPumpComponent15Min(4000)
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
    npx = shutil.which("npx")
    if not npx:
        raise SystemExit("npx not found; install Node.js to export the production HP profile")

    run(
        [
            npx,
            "tsx",
            "--tsconfig",
            "apps/speicher-physik/tsconfig.json",
            "research/wpuq/scripts/export_production_hp_profile.ts",
        ]
    )

    py = sys.executable
    run([py, str(SCRIPTS / "run_phase3_hp_validation.py")])
    run([py, str(SCRIPTS / "plot_phase3.py")])
    run([py, str(SCRIPTS / "write_phase3_report.py")])
    print("\nPhase 3 heat-pump validation complete (research only, no production changes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
