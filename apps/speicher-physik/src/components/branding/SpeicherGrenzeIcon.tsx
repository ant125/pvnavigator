import type { SVGProps } from "react";
import { BatteryMedium } from "lucide-react";

type SpeicherGrenzeIconProps = SVGProps<SVGSVGElement>;

/** Lucide BatteryMedium (white stroke on green tile). */
export function SpeicherGrenzeIcon({
  className,
  strokeWidth = 2,
  ...rest
}: SpeicherGrenzeIconProps) {
  return (
    <BatteryMedium
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden
      {...rest}
    />
  );
}
