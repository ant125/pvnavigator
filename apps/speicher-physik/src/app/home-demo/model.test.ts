import { describe, it, expect } from "vitest";
import { simulateDay, DEMO } from "./model";
describe("homepage demonstration energy balance", () => {
  for (const season of ["summer","winter"] as const) it(season, () => {
    const rows = simulateDay(season);
    expect(rows).toHaveLength(96);
    for (const r of rows) {
      expect(r.energy).toBeGreaterThanOrEqual(0);
      expect(r.energy).toBeLessThanOrEqual(DEMO.capacity);
      expect(r.charge).toBeLessThanOrEqual(DEMO.power);
      expect(r.discharge).toBeLessThanOrEqual(DEMO.power);
      expect(r.charge*r.discharge).toBe(0);
      expect(r.pv+r.imported+r.discharge).toBeCloseTo(r.load+r.charge+r.exported,10);
      expect(r.energy-r.start).toBeCloseTo((r.charge*DEMO.efficiency-r.discharge/DEMO.efficiency)*DEMO.dt,10);
      expect(r.start).toBeCloseTo(r.index ? rows[r.index-1].energy : DEMO.initial,10);
    }
    if (season === "winter") expect(rows.some(r=>r.energy<1e-10)).toBe(true);
    if(season==='summer') {
      expect(rows.some(r=>Math.abs(r.energy-DEMO.capacity)<1e-10)).toBe(true);
      expect(rows.some(r=>r.charge===DEMO.power)).toBe(true);
      expect(rows.some(r=>r.exported>0)).toBe(true);
    }
  });
});
