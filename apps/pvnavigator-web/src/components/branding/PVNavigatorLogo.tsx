import type { ReactNode } from "react";
import { Sun } from "lucide-react";

type PVNavigatorLogoProps = {
  /** Wrapped by parent Link on marketing pages */
  children?: ReactNode;
};

const tile =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 shadow-sm";

/**
 * Header mark: rounded amber tile + optional wordmark (default “PVNavigator”).
 */
export function PVNavigatorLogo({ children = <span className="font-semibold tracking-tight text-[#0F172A]">PVNavigator</span> }: PVNavigatorLogoProps) {
  return (
    <>
      <div className={tile}>
        <Sun className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
      </div>
      {children}
    </>
  );
}
