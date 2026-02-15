/**
 * BDEW H0 Profile – loads and scales hourly consumption profile.
 * Server-only: uses fs. Single source of truth for household load (8760h).
 * Do not import in client components – use @bdew-profile/loader/chart for UI.
 */

import fs from "fs";
import path from "path";

export type HourlyRow = {
  kWh: number;
};

export type BdewProfileKey = "H0";

const BDEW_REFERENCE_GWH = 1_000_000;

function findMonorepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.workspaces) return dir;
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function resolveCsvPath(): string {
  const root = findMonorepoRoot();
  const fromPackages = path.join(
    root,
    "packages",
    "bdew-profile",
    "data",
    "bdew_h0_hourly_nonleap.csv"
  );
  if (fs.existsSync(fromPackages)) return fromPackages;
  const fromNodeModules = path.join(
    process.cwd(),
    "node_modules",
    "@bdew-profile",
    "loader",
    "data",
    "bdew_h0_hourly_nonleap.csv"
  );
  return fs.existsSync(fromNodeModules) ? fromNodeModules : fromPackages;
}

/**
 * Load raw hourly weights from BDEW profile (8760h).
 * Values are for 1 GWh reference (sum ≈ 1e6).
 */
export function loadBDEWProfileHourlies(
  profileKey: BdewProfileKey = "H0"
): number[] {
  if (profileKey !== "H0") {
    throw new Error(`Unsupported BDEW profile: ${profileKey}`);
  }
  const csvPath = resolveCsvPath();
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n");
  const weights = lines.slice(1).map((line) => {
    const parts = line.split(",");
    return Number(parts[4]);
  });
  if (weights.length !== 8760) {
    throw new Error(`BDEW H0 profile row count mismatch: ${weights.length}`);
  }
  return weights;
}

/**
 * Scale hourly weights to annual consumption.
 * hourlyWeights: raw from loadBDEWProfileHourlies (sum ≈ 1e6 for 1 GWh)
 */
export function scaleToAnnualKWh(
  hourlyWeights: number[],
  annualKWh: number
): number[] {
  const scaleFactor = annualKWh / BDEW_REFERENCE_GWH;
  return hourlyWeights.map((w) => w * scaleFactor);
}

export function loadBDEWH0Profile(): HourlyRow[] {
  const weights = loadBDEWProfileHourlies("H0");
  return weights.map((kWh) => ({ kWh }));
}

export function createUserLoadProfile(annualConsumptionKWh: number): number[] {
  const weights = loadBDEWProfileHourlies("H0");
  return scaleToAnnualKWh(weights, annualConsumptionKWh);
}
