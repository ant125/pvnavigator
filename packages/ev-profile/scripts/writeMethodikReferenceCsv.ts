import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createEvProfile } from "../src/createEvProfile";
import { METHODIK_EV_REFERENCE_INPUT } from "../src/methodikReference";
import { buildEvModelDays } from "../src/calendar";
import { EV_SLOTS_PER_DAY } from "../src/constants";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const outDir = path.join(repoRoot, "docs", "public", "methodik", "examples");
const outFile = path.join(outDir, "ev-home-charging-profile-example.csv");

function slotClock(slot: number): string {
  const hour = Math.floor(slot / 4);
  const minute = (slot % 4) * 15;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const result = createEvProfile(METHODIK_EV_REFERENCE_INPUT);
const days = buildEvModelDays(METHODIK_EV_REFERENCE_INPUT.year);
const lines = ["Date,Time,HomeCharging_kWh"];

for (const day of days) {
  const iso = `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
  const offset = day.dayIndex * EV_SLOTS_PER_DAY;
  for (let slot = 0; slot < EV_SLOTS_PER_DAY; slot++) {
    lines.push(`${iso},${slotClock(slot)},${result.profile[offset + slot]}`);
  }
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${lines.join("\n")}\n`, "utf8");

process.stdout.write(
  JSON.stringify(
    {
      outFile,
      rows: result.profile.length,
      annualDrivingDemandKwh: result.meta.annualDrivingDemandKwh,
      drivingServedKwh: result.meta.drivingServedKwh,
      drivingUnservedKwh: result.meta.drivingUnservedKwh,
      homeChargedKwh: result.meta.homeChargedKwh,
      workplaceAcceptedKwh: result.meta.workplaceAcceptedKwh,
      workplaceRejectedKwh: result.meta.workplaceRejectedKwh,
    },
    null,
    2
  ) + "\n"
);
