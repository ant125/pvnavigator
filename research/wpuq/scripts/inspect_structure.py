#!/usr/bin/env python3
"""Inspect WPuQ 15-minute HDF5 files and write a structure summary JSON.

Outputs:
  research/wpuq/processed/structure_summary.json

Also prints a short human-readable report to stdout.
"""

from __future__ import annotations

import json
import sys
from calendar import isleap
from collections import defaultdict
from pathlib import Path

import h5py

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from wpuq_common import (  # noqa: E402
    PROCESSED_DIR,
    RAW_DIR,
    house_sort_key,
    list_raw_files,
    year_from_filename,
)


def summarize_file(path: Path) -> dict:
    year = year_from_filename(path)
    summary: dict = {
        "file": path.name,
        "year": year,
        "size_bytes": path.stat().st_size,
        "top_level_groups": [],
        "houses": {},
        "misc": {},
        "notes": [],
    }

    with h5py.File(path, "r") as h5:
        summary["top_level_groups"] = list(h5.keys())

        for top in h5.keys():
            if top in ("NO_PV", "WITH_PV"):
                for house_id in sorted(h5[top].keys(), key=house_sort_key):
                    feeds = list(h5[f"{top}/{house_id}"].keys())
                    feed_info = {}
                    for feed in feeds:
                        table_path = f"{top}/{house_id}/{feed}/table"
                        if table_path not in h5:
                            feed_info[feed] = {"present": False}
                            continue
                        ds = h5[table_path]
                        feed_info[feed] = {
                            "present": True,
                            "path": table_path,
                            "shape": list(ds.shape),
                            "columns": list(ds.dtype.names or ()),
                        }
                    summary["houses"][house_id] = {
                        "pv_group": top,
                        "feeds": feed_info,
                    }
            elif top == "MISC":
                for mid in h5[top].keys():
                    mid_info: dict = {"children": {}}
                    node = h5[f"{top}/{mid}"]

                    def walk(name: str, obj):
                        if isinstance(obj, h5py.Dataset):
                            mid_info["children"][name] = {
                                "shape": list(obj.shape),
                                "columns": list(obj.dtype.names or ()),
                            }

                    node.visititems(walk)
                    summary["misc"][mid] = mid_info

        # Column-set inventory
        col_sets = defaultdict(list)
        for house_id, info in summary["houses"].items():
            for feed, finfo in info["feeds"].items():
                if finfo.get("present"):
                    key = (info["pv_group"], feed, tuple(finfo["columns"]))
                    col_sets[key].append(house_id)
        summary["column_set_groups"] = [
            {
                "pv_group": k[0],
                "feed": k[1],
                "columns": list(k[2]),
                "houses": v,
                "house_count": len(v),
            }
            for k, v in sorted(col_sets.items(), key=lambda x: (x[0][0], x[0][1], x[0][2]))
        ]

        row_counts = {
            house_id: info["feeds"].get("HOUSEHOLD", {}).get("shape", [None])[0]
            for house_id, info in summary["houses"].items()
            if info["feeds"].get("HOUSEHOLD", {}).get("present")
        }
        unique_rows = sorted({r for r in row_counts.values() if r is not None})
        summary["unique_household_row_counts"] = unique_rows
        if isleap(year):
            summary["is_leap_year"] = True
            summary["notes"].append(
                "Leap year: file retains Feb 29 (35136 quarter-hour steps expected)."
            )
        else:
            summary["is_leap_year"] = False
            summary["notes"].append(
                "Non-leap year: 35040 quarter-hour steps expected (matches PVNavigator production grid length)."
            )

    return summary


def main() -> int:
    files = list_raw_files()
    if not files:
        print(f"No raw HDF5 files found in {RAW_DIR}")
        print("Expected:", ", ".join(["2018_data_15min.hdf5", "2019_data_15min.hdf5", "2020_data_15min.hdf5"]))
        return 1

    report = {
        "dataset": "WPuQ 15-minute electrical load profiles",
        "raw_dir": str(RAW_DIR),
        "files_found": [p.name for p in files],
        "files": [],
    }

    for path in files:
        print(f"Inspecting {path.name} ...")
        summary = summarize_file(path)
        report["files"].append(summary)
        print(
            f"  year={summary['year']} houses={len(summary['houses'])} "
            f"top={summary['top_level_groups']} leap={summary['is_leap_year']} "
            f"row_counts={summary['unique_household_row_counts']}"
        )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out = PROCESSED_DIR / "structure_summary.json"
    with out.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
