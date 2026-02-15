/**
 * BDEW H0 profile chart data – representative 24h weights per season.
 * Derived from bdew_h0_hourly_nonleap.csv (averaged by month + hour).
 * Used for UI chart display only; calculations use loadBDEWH0Profile/createUserLoadProfile.
 */

export type BdewProfileKey = "winter" | "transition" | "summer";

export type BdewProfileEntry = {
  label: string;
  date: string;
  data: number[];
};

/** Representative daily profiles (24h) for chart display. Values in kWh/h for 1 GWh reference. */
export const BDEW_H0_PROFILES: Record<BdewProfileKey, BdewProfileEntry> = {
  winter: {
    label: "Winter Werktag",
    date: "01.01.",
    data: [
      76.339354, 65.451681, 61.543732, 60.7313, 62.868868, 69.887246,
      88.93287, 100.415661, 102.418486, 104.225759, 108.103833, 118.728863,
      120.527649, 116.622537, 113.193363, 115.979555, 130.25563, 157.070205,
      172.428049, 168.948772, 153.446254, 136.527008, 120.38356, 96.866613,
    ],
  },
  transition: {
    label: "Übergang Werktag",
    date: "15.03.",
    data: [
      79.874642, 68.943494, 64.640578, 63.96433, 66.856678, 76.53614,
      95.211806, 105.22645, 107.592255, 110.47816, 113.79061, 123.735863,
      125.123834, 119.502846, 114.417511, 114.56505, 121.231933, 139.577876,
      162.512422, 172.836589, 165.05424, 147.403998, 126.457788, 100.184076,
    ],
  },
  summer: {
    label: "Sommer Werktag",
    date: "15.06.",
    data: [
      93.96003, 81.196025, 75.470604, 73.820452, 75.548296, 82.645813,
      98.086053, 109.890398, 115.04581, 119.738383, 123.910884, 135.357022,
      138.223356, 132.026449, 126.818152, 126.33154, 132.317377, 148.213136,
      164.996033, 169.714194, 166.199482, 158.898148, 143.919339, 115.922135,
    ],
  },
};

/** Format weight for display (Anteil des Jahresverbrauchs). */
export function formatWeight(value: number): string {
  const fraction = value / 1_000_000;
  if (fraction >= 0.001) return fraction.toFixed(4);
  if (fraction >= 0.0001) return fraction.toFixed(5);
  return fraction.toExponential(2);
}
