import type { ReactNode } from "react";

import { SpeicherGrenzeIcon } from "./SpeicherGrenzeIcon";

type SpeicherGrenzeLogoProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
};

const tile =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-emerald-700 shadow-sm";

export function SpeicherGrenzeLogo({
  title = <span className="font-semibold text-slate-100">SpeicherGrenze</span>,
  subtitle = (
    <span className="text-xs text-slate-500 ml-2">
      by PVNavigator
    </span>
  ),
}: SpeicherGrenzeLogoProps) {
  return (
    <>
      <div className={tile}>
        <SpeicherGrenzeIcon className="h-8 w-8 text-white" strokeWidth={2} />
      </div>
      <div>
        {title}
        {subtitle}
      </div>
    </>
  );
}
