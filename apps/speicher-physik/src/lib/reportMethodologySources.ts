import { getMethodologySourceById } from "@pv-methodology/registry";

export type ReportSourceItem = {
  id: string;
  title: string;
  organization: string | null;
  url: string | null;
  linkLabel: string | null;
  detail: string | null;
};

const REPORT_SOURCE_IDS = [
  "pvgis-jrc",
  "pvgis-sarah2",
  "bdew-h25",
  "wpuq-scientific-data",
] as const;

const REPORT_LINK_LABEL: Record<(typeof REPORT_SOURCE_IDS)[number], string> = {
  "pvgis-jrc": "PVGIS (EU JRC)",
  "pvgis-sarah2": "SARAH2 Strahlungsdaten",
  "bdew-h25": "BDEW Standardlastprofile Strom",
  "wpuq-scientific-data": "WPuQ Scientific Data",
};

const REPORT_DETAIL: Partial<
  Record<(typeof REPORT_SOURCE_IDS)[number], string>
> = {
  "wpuq-scientific-data":
    "27 vollständig gemessene deutsche Einfamilienhaushalte (NO_PV, 2019).",
};

/**
 * Compact report citations. URLs come only from the methodology registry.
 */
export function getReportMethodologySources(): ReportSourceItem[] {
  return REPORT_SOURCE_IDS.map((id) => {
    const source = getMethodologySourceById(id);
    if (!source) {
      throw new Error(`Missing methodology source for report: ${id}`);
    }
    return {
      id: source.id,
      title: source.title,
      organization: source.organization,
      url: source.url,
      linkLabel: source.url ? REPORT_LINK_LABEL[id] : null,
      detail: REPORT_DETAIL[id] ?? null,
    };
  });
}
