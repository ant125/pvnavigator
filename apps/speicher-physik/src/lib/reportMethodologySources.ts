import { getMethodologySourceById } from "@pv-methodology/registry";

export type ReportSourceItem = {
  id: string;
  title: string;
  organization: string | null;
  url: string | null;
  linkLabel: string | null;
  detail: string | null;
};

/**
 * Resolved heat-pump citation from the calculation, not from form state.
 * `null` means no heat-pump component was added to the run.
 */
export type ReportHeatPumpCitation = {
  methodologySourceId: string | null;
} | null;

const THERMBUILD_SOURCE_ID = "thermbuild-fordatis-486";

const BASE_REPORT_SOURCE_IDS = [
  "pvgis-jrc",
  "pvgis-sarah2",
  "bdew-h25",
  "wpuq-scientific-data",
] as const;

type ReportSourceId =
  | (typeof BASE_REPORT_SOURCE_IDS)[number]
  | typeof THERMBUILD_SOURCE_ID;

const REPORT_LINK_LABEL: Record<ReportSourceId, string> = {
  "pvgis-jrc": "PVGIS (EU JRC)",
  "pvgis-sarah2": "SARAH2 Strahlungsdaten",
  "bdew-h25": "BDEW Standardlastprofile Strom",
  "wpuq-scientific-data": "WPuQ Scientific Data",
  "thermbuild-fordatis-486": "ThermBuild (Fordatis)",
};

const REPORT_TITLE: Partial<Record<ReportSourceId, string>> = {
  "thermbuild-fordatis-486": "ThermBuild Wärmepumpen-Messdaten",
};

const REPORT_ORGANIZATION: Partial<Record<ReportSourceId, string>> = {
  "thermbuild-fordatis-486": "Fraunhofer / ThermBuild",
};

const REPORT_DETAIL: Partial<Record<ReportSourceId, string>> = {
  "wpuq-scientific-data":
    "27 vollständig gemessene deutsche Einfamilienhaushalte (NO_PV, 2019).",
};

export function usedThermBuildHeatPumpProfile(
  heatPump: ReportHeatPumpCitation | undefined
): boolean {
  return heatPump?.methodologySourceId === THERMBUILD_SOURCE_ID;
}

function toReportSource(id: ReportSourceId): ReportSourceItem {
  const source = getMethodologySourceById(id);
  if (!source) {
    throw new Error(`Missing methodology source for report: ${id}`);
  }
  return {
    id: source.id,
    title: REPORT_TITLE[id] ?? source.title,
    organization: REPORT_ORGANIZATION[id] ?? source.organization,
    url: source.url,
    linkLabel: source.url ? REPORT_LINK_LABEL[id] : null,
    detail: REPORT_DETAIL[id] ?? null,
  };
}

/**
 * Compact report citations. URLs come only from the methodology registry.
 * ThermBuild is included only when the calculation resolved that source id.
 */
export function getReportMethodologySources(
  heatPump?: ReportHeatPumpCitation
): ReportSourceItem[] {
  const sources = BASE_REPORT_SOURCE_IDS.map((id) => toReportSource(id));
  if (usedThermBuildHeatPumpProfile(heatPump)) {
    sources.push(toReportSource(THERMBUILD_SOURCE_ID));
  }
  return sources;
}

/**
 * Footer "inkl." lines. Heat-pump wording is omitted unless a heat-pump
 * component was part of the calculation.
 */
export function getReportDurationInclusions(params: {
  heatPump?: ReportHeatPumpCitation;
  cohortSize: number;
}): string[] {
  const items = ["PVGIS-Wetterdaten", "Batteriesimulation"];
  if (params.heatPump != null) {
    items.push(
      usedThermBuildHeatPumpProfile(params.heatPump)
        ? "gemessenes Wärmepumpenprofil"
        : "Wärmepumpenprofil"
    );
  }
  items.push(`Validierung mit ${params.cohortSize} Referenzhaushalten`);
  return items;
}
