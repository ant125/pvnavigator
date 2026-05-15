import type { LucideIcon } from "lucide-react";
import { BatteryFull, ChartColumnIncreasing, House } from "lucide-react";

export type ProductIconVariant = "speicher-grenze" | "wirtschaftlichkeit" | "pvshadow";

const TILE_BASE =
  "absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl ring-1";
const ICON_SIZE = "h-7 w-7 shrink-0";

const icons = {
  "speicher-grenze": BatteryFull,
  wirtschaftlichkeit: ChartColumnIncreasing,
  pvshadow: House,
} as const satisfies Record<ProductIconVariant, LucideIcon>;

type ProductIconProps = {
  variant: ProductIconVariant;
  /** Background, foreground, ring, and optional group-hover (e.g. Speicher interactive card). */
  tileClassName: string;
};

/** Product toolkit cards on the PVNavigator landing page. */
export function ProductIcon({ variant, tileClassName }: ProductIconProps) {
  const Icon = icons[variant];
  return (
    <div className={`${TILE_BASE} ${tileClassName}`}>
      <Icon className={ICON_SIZE} strokeWidth={2} aria-hidden />
    </div>
  );
}
