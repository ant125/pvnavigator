export type Season = "summer" | "winter";
export const DEMO = { capacity: 8, power: 3, efficiency: 0.95, initial: 2, dt: 0.25 };
// Illustrative hourly anchors with deterministic quarter-hour variation; no PVGIS data.
const summer = [0,0,0,0,0,0.2,0.7,1.6,2.8,4.1,5.2,5.8,6.2,5.7,4.9,4,2.8,1.7,0.7,0.1,0,0,0,0];
const winter = [0,0,0,0,0,0,0,0,0.2,0.6,1.1,1.6,1.9,1.5,0.9,0.3,0,0,0,0,0,0,0,0];
const demand = [0.28,0.25,0.25,0.24,0.26,0.35,0.8,1.4,0.7,0.4,0.45,0.6,1.2,0.6,0.4,0.5,0.8,1.4,2.2,1.8,1.1,0.7,0.45,0.3];
export function simulateDay(season: Season) {
  let energy = DEMO.initial;
  return Array.from({ length: 96 }, (_, index) => {
    const hour = Math.floor(index / 4);
    const pv = (season === "summer" ? summer : winter)[hour] * [0.86,1.04,0.94,1.08][index % 4];
    const load = demand[hour] * [0.9,1.1,1.2,0.8][index % 4] * (season === "winter" ? 1.15 : 1);
    const start = energy;
    const charge = Math.min(Math.max(0, pv-load), DEMO.power, Math.max(0, DEMO.capacity-energy)/(DEMO.dt*DEMO.efficiency));
    const discharge = Math.min(Math.max(0, load-pv), DEMO.power, energy*DEMO.efficiency/DEMO.dt);
    energy = Math.max(0, Math.min(DEMO.capacity, energy + charge*DEMO.dt*DEMO.efficiency - discharge*DEMO.dt/DEMO.efficiency));
    return { index, pv, load, charge, discharge, start, energy, soc: energy/DEMO.capacity*100,
      imported: Math.max(0, load-pv-discharge), exported: Math.max(0, pv-load-charge) };
  });
}
export function timeLabel(index: number) {
  return `${Math.floor(index/4).toString().padStart(2,"0")}:${(index%4*15).toString().padStart(2,"0")}`;
}
