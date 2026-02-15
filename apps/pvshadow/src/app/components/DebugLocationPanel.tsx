"use client";

import { Coordinates, LocationSource, ConfirmedLocation } from "../types/location";
import { BuildingType, isBuildingTypeSupported } from "../types/building";

interface DebugLocationPanelProps {
  coords: Coordinates | null;
  locationSource: LocationSource;
  markerWasDragged: boolean;
  isAddressConfirmed: boolean;
  confirmedLocation: ConfirmedLocation | null;
  buildingType?: BuildingType | null;
  currentStep?: string;
  /** Result of Bavaria boundary check (null if no coords) */
  bavariaCheckPassed?: boolean | null;
}

/**
 * Development-only debug panel for verifying location state.
 * 
 * IMPORTANT:
 * - This component is for internal development verification only
 * - It must NOT appear in production builds
 * - It is strictly read-only and does not modify any state
 * - It reads from the same state used by the pipeline
 * 
 * Shows coordinate validation and Bavaria boundary check results.
 */
export default function DebugLocationPanel({
  coords,
  locationSource,
  markerWasDragged,
  isAddressConfirmed,
  confirmedLocation,
  buildingType,
  currentStep,
  bavariaCheckPassed,
}: DebugLocationPanelProps) {
  // CRITICAL: Only render in development mode
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const isLocked = confirmedLocation?.confirmed === true;
  const isBuildingSupported = isBuildingTypeSupported(buildingType ?? null);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] max-w-sm">
      <div className="bg-slate-900/95 border border-amber-500/50 rounded-lg shadow-xl backdrop-blur-sm">
        {/* Header */}
        <div className="px-3 py-2 border-b border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs font-bold tracking-wider">
              🔧 DEBUG — DEV ONLY
            </span>
            <span className="text-[10px] text-amber-500/70 uppercase">
              Location State
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 font-mono text-xs space-y-3">
          {/* Current Step Section */}
          {currentStep && (
            <div className="space-y-1">
              <div className="text-slate-500 text-[10px] uppercase tracking-wide">
                Flow Step
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                <span className="text-slate-400">Current:</span>
                <span className={`font-semibold ${
                  currentStep === "analysing" 
                    ? "text-sky-400" 
                    : currentStep === "building_type"
                    ? "text-purple-400"
                    : currentStep === "coordinate_validation"
                    ? "text-amber-400"
                    : "text-slate-200"
                }`}>
                  {currentStep}
                </span>
              </div>
            </div>
          )}

          {/* Coordinates Section */}
          <div className="space-y-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide">
              Coordinates
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <span className="text-slate-400">Latitude:</span>
              <span className={`${isLocked ? "text-emerald-400" : "text-slate-200"}`}>
                {coords?.lat?.toFixed(8) ?? "—"}
              </span>
              <span className="text-slate-400">Longitude:</span>
              <span className={`${isLocked ? "text-emerald-400" : "text-slate-200"}`}>
                {coords?.lng?.toFixed(8) ?? "—"}
              </span>
            </div>
          </div>

          {/* State Flags Section */}
          <div className="space-y-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide">
              State Flags
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <span className="text-slate-400">Source:</span>
              <span className={`${
                locationSource === "user_marker" 
                  ? "text-emerald-400" 
                  : "text-amber-400"
              }`}>
                {locationSource}
              </span>
              
              <span className="text-slate-400">Marker dragged:</span>
              <span className={markerWasDragged ? "text-emerald-400" : "text-slate-500"}>
                {markerWasDragged ? "true" : "false"}
              </span>
              
              <span className="text-slate-400">Checkbox:</span>
              <span className={isAddressConfirmed ? "text-emerald-400" : "text-slate-500"}>
                {isAddressConfirmed ? "true" : "false"}
              </span>
              
              <span className="text-slate-400">Confirmed:</span>
              <span className={`font-semibold ${
                confirmedLocation?.confirmed 
                  ? "text-emerald-400" 
                  : "text-rose-400"
              }`}>
                {confirmedLocation?.confirmed ? "true ✓" : "false"}
              </span>
            </div>
          </div>

          {/* Building Type Section */}
          <div className="space-y-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide">
              Building Type
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <span className="text-slate-400">Type:</span>
              <span className={`${
                buildingType 
                  ? isBuildingSupported 
                    ? "text-emerald-400" 
                    : "text-rose-400"
                  : "text-slate-500"
              }`}>
                {buildingType ?? "—"}
              </span>
              
              <span className="text-slate-400">Supported:</span>
              <span className={`font-semibold ${
                buildingType 
                  ? isBuildingSupported 
                    ? "text-emerald-400" 
                    : "text-rose-400"
                  : "text-slate-500"
              }`}>
                {buildingType ? (isBuildingSupported ? "true ✓" : "false ✗") : "—"}
              </span>
            </div>
          </div>

          {/* Bavaria Gate Section */}
          <div className="space-y-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide">
              Bavaria Gate
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <span className="text-slate-400">Inside Bavaria:</span>
              <span className={`font-semibold ${
                bavariaCheckPassed === null
                  ? "text-slate-500"
                  : bavariaCheckPassed
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}>
                {bavariaCheckPassed === null 
                  ? "—" 
                  : bavariaCheckPassed 
                  ? "true ✓" 
                  : "false ✗"
                }
              </span>
            </div>
          </div>

          {/* Confirmation Details */}
          <div className="space-y-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide">
              Confirmation
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <span className="text-slate-400">Confirmed at:</span>
              <span className="text-slate-200 break-all">
                {confirmedLocation?.confirmedAt 
                  ? new Date(confirmedLocation.confirmedAt).toLocaleString("de-DE", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })
                  : "—"
                }
              </span>
            </div>
          </div>

          {/* Lock Status Indicator */}
          {isLocked && (
            <div className="mt-2 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-[10px]">
              🔒 LOCKED — Coordinates will not change automatically
            </div>
          )}

          {/* Warning if not locked but should be */}
          {isAddressConfirmed && !isLocked && (
            <div className="mt-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-[10px]">
              ⚠️ Checkbox checked but not yet confirmed via &quot;Weiter&quot;
            </div>
          )}

          {/* Building type warning */}
          {buildingType && !isBuildingSupported && (
            <div className="mt-2 px-2 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-[10px]">
              🚫 BLOCKED — Unsupported building type for MVP
            </div>
          )}

          {/* Bavaria gate warning */}
          {bavariaCheckPassed === false && (
            <div className="mt-2 px-2 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-[10px]">
              🚫 BLOCKED — Outside Bavaria (supported region)
            </div>
          )}

          {/* Ready for analysis indicator */}
          {isLocked && buildingType && isBuildingSupported && bavariaCheckPassed && (
            <div className="mt-2 px-2 py-1.5 bg-sky-500/10 border border-sky-500/30 rounded text-sky-400 text-[10px]">
              ✅ READY — Can proceed to roof analysis
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-slate-700/50 bg-slate-800/30">
          <span className="text-[9px] text-slate-600">
            Read-only • No state modification • Temp debug UI
          </span>
        </div>
      </div>
    </div>
  );
}
