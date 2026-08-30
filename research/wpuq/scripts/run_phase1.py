#!/usr/bin/env python3
"""Run all WPuQ Phase 1 inspection/inventory scripts."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def run(script: str) -> None:
    cmd = [sys.executable, str(SCRIPT_DIR / script)]
    print(f"\n$ {' '.join(cmd)}")
    subprocess.check_call(cmd)


def main() -> int:
    run("inspect_structure.py")
    run("build_inventory.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
