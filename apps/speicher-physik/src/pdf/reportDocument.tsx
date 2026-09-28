import * as fontkit from "fontkit";
import React from "react";
import {
  Circle,
  Document,
  Font,
  G,
  Image,
  Line,
  Link,
  Page,
  Path,
  Polyline,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import { pdfAsset } from "./pdfAssets";

// Inside <Svg>, react-pdf renders <Text> as SVG text with x/y/transform.
const SvgText = Text as unknown as React.ComponentType<Record<string, unknown>>;

const fontFile = (name: string) => pdfAsset("fonts", name);

Font.register({
  family: "Inter",
  fonts: [
    { src: fontFile("Inter-Regular.ttf"), fontWeight: 400 },
    { src: fontFile("Inter-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: fontFile("Inter-Medium.ttf"), fontWeight: 500 },
    { src: fontFile("Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: fontFile("Inter-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Plex",
  fonts: [
    { src: fontFile("IBMPlexMono-Regular.ttf"), fontWeight: 400 },
    { src: fontFile("IBMPlexMono-Medium.ttf"), fontWeight: 500 },
    { src: fontFile("IBMPlexMono-SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

// ---------------------------------------------------------------------------
// Page geometry: A4, margins 25 mm left, 20 mm right/top/bottom.
// The footer sits inside the bottom margin, below the content area.
// ---------------------------------------------------------------------------
const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const MARGIN_LEFT = 25 * MM;
const MARGIN_RIGHT = 20 * MM;
const MARGIN_TOP = 20 * MM;
const MARGIN_BOTTOM = 20 * MM;
const PAGE_H = 297 * MM;
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT; // ≈ 467.7 pt
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM; // ≈ 728.5 pt
const FOOTER_BOTTOM = 9 * MM; // footer baseline area, clear of the content

// ---------------------------------------------------------------------------
// Spacing scale. Each boundary is controlled by exactly one property:
//   - paragraphs inside a block: the block's `gap` (SP_TEXT)
//   - between semantic blocks inside a section: the section's `gap` (SP_BLOCK)
//   - after a section heading: the heading's marginBottom (SP_AFTER_H2)
//   - between sections: the section's marginTop + rule padding
// ---------------------------------------------------------------------------
const SP_TEXT = 6; // paragraph ↔ paragraph, subtitle ↔ text
const SP_BLOCK = 16; // before a new semantic block
const SP_AFTER_H1 = 10;
const SP_AFTER_H2 = 9;
const SP_SECTION = 18; // above the section rule
const SP_SECTION_INNER = 14; // below the section rule

const ink = "#2c2c28";
const secondary = "#5c5a52";
const muted = "#6f6c63";
const line = "#d9d2c4";
const lineSoft = "#e8e2d4";
const accent = "#2f4a3c";
const accentSoft = "#e4eee8";
const paper = "#ffffff";
const mutedSurface = "#efe9dc";
const sceneSurface = "#f7f4ef";
const chartGrid = "#e4ddd0";
const chartLine = "#3d6b54";
const chartMarker = "#b45309";
const beige = "#e4ddd0";

const styles = StyleSheet.create({
  page: {
    backgroundColor: paper,
    paddingTop: MARGIN_TOP,
    paddingBottom: MARGIN_BOTTOM,
    paddingLeft: MARGIN_LEFT,
    paddingRight: MARGIN_RIGHT,
    fontFamily: "Inter",
    fontSize: 10.5,
    lineHeight: 1.4,
    color: ink,
  },
  pageHeader: {
    position: "absolute",
    top: 8 * MM,
    left: MARGIN_LEFT,
    right: MARGIN_RIGHT,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingBottom: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: line,
  },
  pageHeaderMark: {
    fontFamily: "Plex",
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: 1.2,
    color: accent,
  },
  footerRule: {
    position: "absolute",
    left: MARGIN_LEFT,
    right: MARGIN_RIGHT,
    bottom: FOOTER_BOTTOM + 18,
    height: 0.6,
    backgroundColor: line,
  },
  footerLink: {
    position: "absolute",
    left: MARGIN_LEFT,
    bottom: FOOTER_BOTTOM,
    fontFamily: "Inter",
    fontSize: 9,
    lineHeight: 1.2,
    color: accent,
    textDecoration: "underline",
  },
  testBanner: {
    position: "absolute",
    left: MARGIN_LEFT,
    right: MARGIN_RIGHT,
    top: 7 * MM,
    fontFamily: "Plex",
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 0.6,
    color: chartMarker,
    borderBottomWidth: 0.6,
    borderBottomColor: chartMarker,
    paddingBottom: 3,
  },

  // Page-1 masthead -----------------------------------------------------------
  masthead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 7,
    marginBottom: 14,
    borderBottomWidth: 0.8,
    borderBottomColor: line,
  },
  mastheadBrand: {
    fontFamily: "Plex",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1.2,
    color: accent,
  },
  mastheadProduct: {
    fontFamily: "Plex",
    fontSize: 9,
    fontWeight: 400,
    letterSpacing: 1.2,
    color: secondary,
  },
  heroRow: {
    flexDirection: "row",
    gap: 18,
    alignItems: "flex-start",
  },
  heroCopy: {
    flexGrow: 1,
    flexBasis: 0,
    paddingTop: 2,
  },
  heroTitle: {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.3,
    lineHeight: 1.12,
    color: ink,
  },
  heroScene: {
    width: "42%",
    flexShrink: 0,
    alignItems: "center",
  },
  overviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: lineSoft,
  },
  overviewLabel: {
    fontSize: 9.5,
    lineHeight: 1.3,
    color: secondary,
  },
  overviewValue: {
    fontFamily: "Plex",
    fontSize: 9.5,
    lineHeight: 1.3,
    fontWeight: 500,
    color: ink,
    flexShrink: 1,
    textAlign: "right",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    maxWidth: "100%",
    borderWidth: 0.6,
    borderColor: line,
    backgroundColor: "#fbfaf7",
    borderRadius: 2,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  chipText: {
    fontSize: 9.5,
    lineHeight: 1.3,
    color: ink,
  },
  kpiPair: {
    flexDirection: "row",
    gap: 16,
    alignItems: "stretch",
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: 0,
  },
  kpiCardSecondary: {
    flexGrow: 1,
    flexBasis: 0,
    paddingLeft: 12,
    borderLeftWidth: 1.2,
    borderLeftColor: ink,
  },
  kpiValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 40,
  },
  kpiValuePrimary: {
    fontFamily: "Plex",
    fontSize: 38,
    fontWeight: 600,
    color: accent,
    lineHeight: 1,
  },
  kpiValueSecondary: {
    fontFamily: "Plex",
    fontSize: 26,
    fontWeight: 500,
    color: secondary,
    lineHeight: 1,
  },
  kpiUnitPrimary: {
    fontFamily: "Plex",
    fontSize: 14,
    fontWeight: 500,
    color: accent,
    marginLeft: 5,
    marginBottom: 3,
  },
  kpiUnitSecondary: {
    fontFamily: "Plex",
    fontSize: 10,
    fontWeight: 500,
    color: secondary,
    marginLeft: 5,
    marginBottom: 2,
  },
  kpiTitle: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 1.25,
    fontWeight: 600,
    color: ink,
  },
  why: {
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: accent,
    gap: 3,
  },

  // Headings ---------------------------------------------------------------
  eyebrow: {
    fontFamily: "Plex",
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: accent,
    marginBottom: 4,
  },
  h1: {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.2,
    lineHeight: 1.15,
    color: ink,
    marginBottom: SP_AFTER_H1,
  },
  h2: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: -0.1,
    lineHeight: 1.2,
    color: ink,
    marginBottom: SP_AFTER_H2,
  },
  h3: {
    fontFamily: "Inter",
    fontSize: 11.5,
    fontWeight: 600,
    lineHeight: 1.25,
    color: ink,
  },

  // Text ----------------------------------------------------------------------
  body: {
    fontSize: 10.5,
    lineHeight: 1.4,
    color: ink,
  },
  bodyStrong: {
    fontSize: 10.5,
    lineHeight: 1.4,
    fontWeight: 600,
    color: ink,
  },
  note: {
    fontSize: 9,
    lineHeight: 1.3,
    color: secondary,
  },
  caveat: {
    fontSize: 9,
    lineHeight: 1.3,
    fontStyle: "italic",
    color: secondary,
  },
  meta: {
    fontSize: 9.5,
    lineHeight: 1.3,
    color: secondary,
  },
  address: {
    fontSize: 11.5,
    lineHeight: 1.35,
    color: ink,
  },
  label: {
    fontFamily: "Plex",
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: muted,
  },

  // Layout ---------------------------------------------------------------------
  section: {
    marginTop: SP_SECTION,
    paddingTop: SP_SECTION_INNER,
    borderTopWidth: 0.8,
    borderTopColor: line,
  },
  // Page-start chapters use the header rule only. The 20 mm top margin is the
  // gap from that rule down to the eyebrow (about 18–24 pt).
  sectionStart: {},
  blocks: {
    flexDirection: "column",
    gap: SP_BLOCK,
  },
  textBlock: {
    flexDirection: "column",
    gap: SP_TEXT,
  },
  two: {
    flexDirection: "row",
    gap: 20,
  },
  col: {
    flexGrow: 1,
    flexBasis: 0,
  },

  // Hero -----------------------------------------------------------------------
  kpi: {
    fontFamily: "Plex",
    fontSize: 28,
    fontWeight: 600,
    color: ink,
    lineHeight: 1,
  },
  kpiUnit: {
    fontFamily: "Plex",
    fontSize: 12,
    fontWeight: 500,
    color: ink,
  },
  planningRow: {
    marginTop: SP_BLOCK,
    paddingTop: 10,
    borderTopWidth: 0.6,
    borderTopColor: lineSoft,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  planningValue: {
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: 500,
    color: secondary,
  },

  // Benefit comparison ---------------------------------------------------------
  barRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  barTrack: {
    height: 7,
    borderRadius: 1,
  },
  barFill: {
    height: 7,
    backgroundColor: accent,
  },
  scale: {
    marginTop: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Plex",
    fontSize: 7.5,
    color: muted,
  },
  callout: {
    backgroundColor: accentSoft,
    paddingVertical: 8,
    paddingHorizontal: 9,
    fontSize: 10,
    lineHeight: 1.35,
    fontWeight: 500,
    color: ink,
  },
  legend: {
    flexDirection: "row",
    gap: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    fontSize: 9,
    color: secondary,
  },
  swatch: {
    width: 8,
    height: 8,
    marginRight: 5,
  },

  // Anlage -----------------------------------------------------------------------
  anlage: {
    flexDirection: "row",
    gap: 20,
    alignItems: "flex-start",
  },
  anlageScene: {
    width: "45%",
    flexShrink: 0,
    alignItems: "center",
    paddingTop: 2,
  },
  anlageData: {
    flexGrow: 1,
    flexBasis: 0,
  },
  inputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: lineSoft,
  },
  inputRowStacked: {
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: lineSoft,
  },
  inputLabel: {
    fontSize: 9.5,
    lineHeight: 1.3,
    color: secondary,
  },
  inputValue: {
    fontFamily: "Plex",
    fontSize: 9.5,
    lineHeight: 1.3,
    fontWeight: 500,
    color: ink,
    flexShrink: 0,
  },

  // Formula -----------------------------------------------------------------------
  formula: {
    backgroundColor: mutedSurface,
    borderWidth: 0.6,
    borderColor: lineSoft,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "column",
    gap: 3,
  },
  formulaLabel: {
    fontSize: 9,
    lineHeight: 1.3,
    color: secondary,
  },
  formulaExpression: {
    fontFamily: "Plex",
    fontSize: 10,
    lineHeight: 1.3,
    fontWeight: 500,
    color: ink,
  },

  // Metrics (Bilanz) ---------------------------------------------------------------
  metric: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: lineSoft,
  },
  metricLabel: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: "76%",
    fontSize: 10,
    lineHeight: 1.35,
    color: ink,
  },
  metricHelp: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 1.3,
    color: secondary,
  },
  metricValue: {
    fontFamily: "Plex",
    fontSize: 9.5,
    lineHeight: 1.35,
    fontWeight: 500,
    color: ink,
    flexShrink: 0,
  },
  metricAccent: {
    fontFamily: "Plex",
    fontSize: 9.5,
    lineHeight: 1.35,
    fontWeight: 600,
    color: accent,
    flexShrink: 0,
  },
  band: {
    borderWidth: 0.6,
    borderColor: lineSoft,
    backgroundColor: mutedSurface,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  // Tables ----------------------------------------------------------------------------
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: lineSoft,
    alignItems: "center",
  },
  th: {
    backgroundColor: mutedSurface,
    borderBottomWidth: 0.8,
    borderBottomColor: line,
    paddingVertical: 5,
    paddingHorizontal: 5,
    fontSize: 9,
    lineHeight: 1.3,
    fontWeight: 600,
    color: ink,
  },
  td: {
    paddingVertical: 4.5,
    paddingHorizontal: 5,
    fontSize: 9.5,
    lineHeight: 1.3,
    color: secondary,
  },
  tdStrong: {
    paddingVertical: 4.5,
    paddingHorizontal: 5,
    fontFamily: "Plex",
    fontSize: 10,
    lineHeight: 1.3,
    fontWeight: 600,
    color: ink,
  },

  // Distribution ------------------------------------------------------------------------
  distItem: {
    marginTop: 7,
  },
  distLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Plex",
    fontSize: 9.5,
    lineHeight: 1.3,
    color: ink,
    marginBottom: 3,
  },
  distTrack: {
    height: 6,
    backgroundColor: mutedSurface,
    borderRadius: 1,
  },
  distFill: {
    height: 6,
    backgroundColor: accent,
    borderRadius: 1,
  },

  // Sources ----------------------------------------------------------------------------------
  sourceTitle: {
    fontSize: 10.5,
    lineHeight: 1.35,
    fontWeight: 600,
    color: ink,
  },
  link: {
    fontSize: 9.5,
    lineHeight: 1.3,
    color: accent,
    textDecoration: "none",
  },
});

type InputRow = { label: string; value: string; help?: string };

export type PdfModel = {
  savedAt: string;
  batteryModelVersion: string | null;
  address: string;
  technical: { value: string; unit: string; caption: string };
  planning: { value: string; unit: string; caption: string };
  robustnessOverviewTitle: string;
  householdSummary: string;
  benefit: {
    scaleEnd: string;
    ohneLabel: string;
    mitLabel: string;
    ohneFill: number | null;
    mitFill: number | null;
    gain: string;
    autarkieOhne: string;
    autarkieMit: string;
    solarOhne: number | null;
    solarMit: number | null;
    grid: string;
    zeroPct: string;
    fullPct: string;
  };
  overviewNote: string | null;
  basisNote: string;
  scene: {
    src: string;
    caption: string;
    heatPump: "luftwasser" | "wasserwasser" | null;
    ev: boolean;
    backup: boolean;
  };
  layoutTest: { banner: string } | null;
  chips: { text: string }[];
  inputs: InputRow[];
  chart: {
    points: { size: number; eigenverbrauch: number; label: string }[];
    yMin: number;
    yMax: number;
    yTicks: { value: number; label: string }[];
    markerSize: number;
    markerIndex: number;
    markerAnchor: "start" | "end" | "middle";
    lead: string;
    ageing: string;
    formulaLabel: string;
    formulaExpression: string;
    formulaRounding: string;
    xAxisLabel: string;
    yAxisLabel: string;
    caveat: string;
    planningExceedsSimulatedRange: boolean;
  };
  robustness: {
    lead: string;
    follow: string | null;
    question: string;
    hint: string;
    explanation: string[];
    appendixCount: number | null;
    stability: string;
    compare: {
      primaryLabel: string;
      rangeLabel: string;
      rows: { label: string; primary: string; range: string }[];
    };
    distribution: { label: string; count: string; width: number }[];
  };
  balance: {
    helper: string;
    rowsLeft: { label: string; value: string; help?: string; accent?: boolean }[];
    rowsRight: { label: string; value: string; help?: string; accent?: boolean }[];
    losses: {
      total: string;
      note: string;
      items: { label: string; value: string }[];
    } | null;
  };
  methodik: {
    principles: string[];
    assessment: string[];
    quellenIntro: string;
    methodikUrl: string;
    sources: {
      title: string;
      detail: string | null;
      organization: string | null;
      linkLabel: string | null;
      url: string | null;
    }[];
    disclaimer: string;
  };
  profiles: {
    title: string;
    headers: string[];
    rows: { profil: string; size: string; eigenverbrauch: string; autarkie: string }[];
  };
};

function t(value: string): string {
  // IBM Plex Mono has no U+202F. A normal no-break space keeps the same
  // grouping and does not break the line. Digits are unchanged.
  return value.replaceAll("\u202F", "\u00A0");
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

// A heading never stays alone at a page bottom: it requires at least
// `minPresenceAhead` points of following content on the same page.
const KEEP_WITH_NEXT = 90;

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View minPresenceAhead={KEEP_WITH_NEXT}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.h2}>{title}</Text>
    </View>
  );
}

function SubHeading({ children }: { children: string }) {
  return (
    <View minPresenceAhead={60}>
      <Text style={styles.h3}>{children}</Text>
    </View>
  );
}

function EnergyBar({ fill }: { fill: number | null }) {
  const width = fill === null ? 0 : Math.max(0, Math.min(100, fill));
  // Eigenverbrauch: green on a transparent track, no outline of the empty part.
  return (
    <View style={styles.barTrack}>
      {width > 0 ? <View style={[styles.barFill, { width: `${width}%` }]} /> : null}
    </View>
  );
}

function AutarkieBar({ solar }: { solar: number | null }) {
  const width = solar === null ? 0 : Math.max(0, Math.min(100, solar));
  // Beige = Netzstrom up to 100 %, green = eigener Solarstrom.
  return (
    <View style={[styles.barTrack, { backgroundColor: beige }]}>
      {width > 0 ? <View style={[styles.barFill, { width: `${width}%` }]} /> : null}
    </View>
  );
}

function BenefitColumn({
  title,
  intro,
  rows,
  scale,
  callout,
  legend,
}: {
  title: string;
  intro: string;
  rows: { label: string; value: string; accent?: boolean; bar: React.ReactNode }[];
  scale: [string, string];
  callout: string;
  legend?: React.ReactNode;
}) {
  return (
    <View style={[styles.col, styles.textBlock]}>
      <Text style={styles.h3}>{title}</Text>
      <Text style={styles.body}>{intro}</Text>
      <View wrap={false}>
        {rows.map((row, index) => (
          <View key={row.label} style={index > 0 ? { marginTop: 8 } : undefined}>
            <View style={styles.barRow}>
              <Text style={styles.body}>{row.label}</Text>
              <Text style={row.accent ? styles.metricAccent : styles.metricValue}>
                {t(row.value)}
              </Text>
            </View>
            {row.bar}
          </View>
        ))}
        <View style={styles.scale}>
          <Text>{t(scale[0])}</Text>
          <Text>{t(scale[1])}</Text>
        </View>
      </View>
      <Text style={styles.callout}>{t(callout)}</Text>
      {legend ?? null}
    </View>
  );
}

function MetricRow({
  row,
}: {
  row: { label: string; value: string; help?: string; accent?: boolean };
}) {
  return (
    <View style={styles.metric} wrap={false}>
      <View style={styles.metricLabel}>
        <Text>{row.label}</Text>
        {row.help ? <Text style={styles.metricHelp}>{row.help}</Text> : null}
      </View>
      <Text style={row.accent ? styles.metricAccent : styles.metricValue}>{t(row.value)}</Text>
    </View>
  );
}

function CompareTable({
  primaryLabel,
  rangeLabel,
  rows,
}: {
  primaryLabel: string;
  rangeLabel: string;
  rows: { label: string; primary: string; range: string }[];
}) {
  return (
    <View wrap={false}>
      <View style={styles.tr}>
        <Text style={[styles.th, { width: "34%" }]}>Kennwert</Text>
        <Text style={[styles.th, { width: "33%" }]}>{primaryLabel}</Text>
        <Text style={[styles.th, { width: "33%", color: secondary }]}>{rangeLabel}</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.tr} wrap={false}>
          <Text style={[styles.td, { width: "34%", color: ink, fontWeight: 600 }]}>
            {row.label}
          </Text>
          <Text style={[styles.tdStrong, { width: "33%" }]}>{t(row.primary)}</Text>
          <Text style={[styles.td, { width: "33%", fontFamily: "Plex" }]}>{t(row.range)}</Text>
        </View>
      ))}
    </View>
  );
}

const PROFILE_WIDTHS = ["22%", "26%", "28%", "24%"];

function ProfileHeader() {
  const headers = ["Profil", "Speichergröße", "Eigenverbrauch", "Autarkie"];
  // `fixed` repeats the header row on every page the table spans.
  return (
    <View style={styles.tr} fixed>
      {headers.map((header, index) => (
        <Text
          key={header}
          style={[
            styles.th,
            { width: PROFILE_WIDTHS[index], textAlign: index === 0 ? "left" : "right" },
          ]}
        >
          {header}
        </Text>
      ))}
    </View>
  );
}

function ProfileRow({
  row,
}: {
  row: { profil: string; size: string; eigenverbrauch: string; autarkie: string };
}) {
  const cells = [row.profil, t(row.size), t(row.eigenverbrauch), t(row.autarkie)];
  return (
    <View style={styles.tr} wrap={false}>
      {cells.map((cell, index) => (
        <Text
          key={cell + index}
          style={[
            styles.td,
            {
              width: PROFILE_WIDTHS[index],
              textAlign: index === 0 ? "left" : "right",
              fontFamily: index === 0 ? "Inter" : "Plex",
              color: index === 0 ? ink : secondary,
              fontWeight: index === 0 ? 600 : 400,
            },
          ]}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

function Formula({ chart }: { chart: PdfModel["chart"] }) {
  return (
    <View style={styles.formula} wrap={false}>
      <Text style={styles.formulaLabel}>{chart.formulaLabel}</Text>
      <Text style={styles.formulaExpression}>{t(chart.formulaExpression)}</Text>
      <Text style={styles.formulaLabel}>{chart.formulaRounding}</Text>
    </View>
  );
}

function Chart({ chart }: { chart: PdfModel["chart"] }) {
  const width = CONTENT_W;
  const height = 268;
  const left = 64;
  const right = 8;
  const top = 22;
  const bottom = 44;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const xOf = (index: number) =>
    left + (chart.points.length === 1 ? plotW / 2 : (index / (chart.points.length - 1)) * plotW);
  const yOf = (value: number) => {
    const span = chart.yMax - chart.yMin || 1;
    return top + (1 - (value - chart.yMin) / span) * plotH;
  };
  const points = chart.points
    .map((point, index) => `${xOf(index)},${yOf(point.eigenverbrauch)}`)
    .join(" ");
  const markerX = chart.markerIndex >= 0 ? xOf(chart.markerIndex) : null;

  return (
    <View wrap={false} style={{ position: "relative" }}>
      <Svg width={width} height={height}>
        {chart.yTicks.map((tick) => (
          <Line
            key={tick.value}
            x1={left}
            x2={width - right}
            y1={yOf(tick.value)}
            y2={yOf(tick.value)}
            stroke={chartGrid}
            strokeWidth={1}
          />
        ))}
        {markerX !== null ? (
          <Line
            x1={markerX}
            x2={markerX}
            y1={top}
            y2={top + plotH}
            stroke={chartMarker}
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />
        ) : null}
        <Polyline points={points} stroke={chartLine} strokeWidth={2.2} fill="none" />
        {chart.points.map((point, index) => {
          const marked = point.size === chart.markerSize;
          return (
            <Circle
              key={point.size}
              cx={xOf(index)}
              cy={yOf(point.eigenverbrauch)}
              r={marked ? 4.2 : 2.1}
              fill={marked ? chartMarker : chartLine}
              stroke={marked ? paper : "none"}
              strokeWidth={marked ? 1.4 : 0}
            />
          );
        })}
        <G transform={`rotate(-90 12 ${top + plotH / 2})`}>
          <SvgText
            x={12}
            y={top + plotH / 2 + 3}
            textAnchor="middle"
            style={{ fontFamily: "Inter", fontSize: 8, fill: secondary }}
          >
            {chart.yAxisLabel}
          </SvgText>
        </G>
      </Svg>
      <View style={{ position: "absolute", left: 0, top: 0, width, height }}>
        {chart.yTicks.map((tick) => (
          <Text
            key={tick.value}
            style={{
              position: "absolute",
              left: 18,
              top: yOf(tick.value) - 4.5,
              width: left - 24,
              textAlign: "right",
              fontFamily: "Plex",
              fontSize: 7.5,
              color: secondary,
            }}
          >
            {t(tick.label)}
          </Text>
        ))}
        {chart.points.map((point, index) => (
          <Text
            key={point.size}
            style={{
              position: "absolute",
              left: xOf(index) - 9,
              top: top + plotH + 6,
              width: 18,
              textAlign: "center",
              fontFamily: "Plex",
              fontSize: 7,
              color: secondary,
            }}
          >
            {t(point.label)}
          </Text>
        ))}
        <Text
          style={{
            position: "absolute",
            left,
            top: top + plotH + 23,
            width: plotW,
            textAlign: "center",
            fontFamily: "Inter",
            fontSize: 8,
            color: secondary,
          }}
        >
          {chart.xAxisLabel}
        </Text>
        {markerX !== null ? (
          <Text
            style={{
              position: "absolute",
              left: Math.min(Math.max(markerX + 8, left), width - 132),
              top: 2,
              width: 128,
              fontFamily: "Inter",
              fontSize: 8,
              color: chartMarker,
            }}
          >
            Technische Speichergrenze
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Text measurement (fontkit, same TTFs as the PDF) for the Anlage pagination.
// Only the "Anlage & Eingaben" rows are paginated by hand, because a
// continuation heading cannot be produced by the layout engine itself.
// ---------------------------------------------------------------------------
const interRegular = fontkit.openSync(fontFile("Inter-Regular.ttf")) as fontkit.Font;
const plexMedium = fontkit.openSync(fontFile("IBMPlexMono-Medium.ttf")) as fontkit.Font;

function textWidth(font: fontkit.Font, text: string, size: number): number {
  return (font.layout(text).advanceWidth / font.unitsPerEm) * size;
}

function wrapPieces(text: string): string[] {
  const prepared = text.replaceAll("-", "-\u200B");
  const pieces: string[] = [];
  for (const word of prepared.split(" ")) {
    for (const part of word.split("\u200B")) {
      if (part) pieces.push(part);
    }
  }
  return pieces;
}

function lineCount(font: fontkit.Font, text: string, size: number, maxWidth: number): number {
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    const words = wrapPieces(paragraph);
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let current = "";
    let count = 1;
    for (const word of words) {
      const candidate = current ? `${current}${current.endsWith("-") ? "" : " "}${word}` : word;
      if (current && textWidth(font, candidate, size) > maxWidth) {
        count += 1;
        current = word;
        while (textWidth(font, current, size) > maxWidth && current.length > 1) {
          count += 1;
          current = current.slice(Math.max(1, Math.floor(current.length / 2)));
        }
      } else {
        current = candidate;
      }
    }
    lines += count;
  }
  return Math.max(1, lines);
}

// Geometry of the Anlage block, derived from the styles above.
const ANLAGE_GAP = 20;
const SCENE_COL_W = CONTENT_W * 0.45;
const DATA_COL_W = CONTENT_W - SCENE_COL_W - ANLAGE_GAP;
const INPUT_LABEL_LINE = 9.5 * 1.3;
const INPUT_HELP_LINE = 9 * 1.3;
const INPUT_ROW_PADDING = 3.5 * 2 + 0.5; // paddingVertical ×2 + border
const HEADING_H = 8 * 1.4 + 4 + 15 * 1.2 + SP_AFTER_H2; // eyebrow + h2
const SECTION_TOP_H = SP_SECTION + SP_SECTION_INNER + 0.8; // rule block
// Heading + chart + short conclusion (kept together as one block).
const CHART_BLOCK_H = SECTION_TOP_H + HEADING_H + 268 + SP_BLOCK + 2 * 10.5 * 1.4;

function inputRowHeight(row: InputRow, columnWidth: number): number {
  if (row.label === "Adresse") {
    const valueLines = lineCount(plexMedium, t(row.value), 9, columnWidth);
    return INPUT_ROW_PADDING + INPUT_LABEL_LINE + valueLines * INPUT_HELP_LINE;
  }
  const valueW = textWidth(plexMedium, t(row.value), 9.5);
  const labelW = Math.max(40, columnWidth - valueW - 10);
  const labelLines = lineCount(interRegular, row.label, 9.5, labelW);
  const helpLines = row.help ? lineCount(interRegular, t(row.help), 9, labelW) : 0;
  return (
    INPUT_ROW_PADDING +
    labelLines * INPUT_LABEL_LINE +
    (helpLines > 0 ? 2 + helpLines * INPUT_HELP_LINE : 0)
  );
}

/**
 * Splits the input rows into the part next to the scene (page 2) and the
 * continuation pages ("Anlage & Eingaben — Fortsetzung"). Rows are never
 * split. Estimates are slightly conservative so the block can only end
 * earlier than the footer, never overlap it.
 */
function paginateInputs(rows: InputRow[]) {
  const safety = 0.9;
  const firstPageAvail = (CONTENT_H - SECTION_TOP_H - HEADING_H) * safety;
  const contAvail = (CONTENT_H - SECTION_TOP_H - HEADING_H) * safety;
  const chunks: InputRow[][] = [[]];
  let used = 0;
  let avail = firstPageAvail;
  const width = CONTENT_W;
  for (const row of rows) {
    const h = inputRowHeight(row, width);
    if (chunks[chunks.length - 1].length > 0 && used + h > avail) {
      chunks.push([]);
      used = 0;
      avail = contAvail;
    }
    chunks[chunks.length - 1].push(row);
    used += h;
  }
  const lastChunk = chunks[chunks.length - 1];
  const lastBlockH = lastChunk.reduce((acc, row) => acc + inputRowHeight(row, width), 0);
  const chartFitsBelow = lastBlockH / safety + CHART_BLOCK_H <= CONTENT_H - SECTION_TOP_H - HEADING_H;
  return { chunks, chartFitsBelow, estimate: { lastBlockH, firstPageAvail } };
}

const CHIP_GAP = 6;
const CHIP_PAD_X = 14;
const CHIP_PAD_Y = 6;
const CHIP_FONT = 9.5;
const CHIP_LINE = CHIP_FONT * 1.3;
// About three single-line rows. Anything taller continues on the next page.
const FIRST_PAGE_CHIP_H = 84;

function chipBox(text: string): { w: number; h: number } {
  const inner = CONTENT_W - CHIP_PAD_X - 1.2;
  const natural = textWidth(interRegular, t(text), CHIP_FONT);
  if (natural <= inner) {
    return {
      w: Math.min(CONTENT_W, natural + CHIP_PAD_X + 1.2),
      h: CHIP_LINE + CHIP_PAD_Y + 1.2,
    };
  }
  const lines = lineCount(interRegular, t(text), CHIP_FONT, inner);
  return { w: CONTENT_W, h: lines * CHIP_LINE + CHIP_PAD_Y + 1.2 };
}

/** Keeps whole chips on page 1 until the block would grow past the cover budget. */
function paginateChips(chips: { text: string }[]) {
  type Row = { items: { text: string }[]; h: number };
  const rows: Row[] = [];
  let items: { text: string }[] = [];
  let rowW = 0;
  let rowH = 0;
  for (const chip of chips) {
    const box = chipBox(chip.text);
    const nextW = items.length === 0 ? box.w : rowW + CHIP_GAP + box.w;
    if (items.length > 0 && nextW > CONTENT_W + 0.5) {
      rows.push({ items, h: rowH });
      items = [chip];
      rowW = box.w;
      rowH = box.h;
    } else {
      items.push(chip);
      rowW = nextW;
      rowH = Math.max(rowH, box.h);
    }
  }
  if (items.length > 0) rows.push({ items, h: rowH });

  const firstRows: Row[] = [];
  const restRows: Row[] = [];
  let used = 0;
  let open = true;
  for (const row of rows) {
    const add = (used > 0 ? CHIP_GAP : 0) + row.h;
    if (open && used + add <= FIRST_PAGE_CHIP_H) {
      firstRows.push(row);
      used += add;
    } else {
      open = false;
      restRows.push(row);
    }
  }
  return {
    first: firstRows.flatMap((row) => row.items),
    restRows,
  };
}

function FactChips({ chips }: { chips: { text: string }[] }) {
  return (
    <View style={styles.chipWrap}>
      {chips.map((chip) => (
        <View key={chip.text} style={styles.chip} wrap={false}>
          <Text style={styles.chipText}>{t(chip.text)}</Text>
        </View>
      ))}
    </View>
  );
}

function InputRows({ rows }: { rows: InputRow[] }) {
  return (
    <>
      {rows.map((item) =>
        item.label === "Adresse" ? (
          <View key={`${item.label}-${item.value.slice(0, 24)}`} style={styles.inputRowStacked} wrap={false}>
            <Text style={styles.inputLabel}>{item.label}</Text>
            <Text style={[styles.inputValue, { fontSize: 9, flexShrink: 1 }]}>{t(item.value)}</Text>
          </View>
        ) : (
          <View key={`${item.label}-${item.value}`} style={styles.inputRow} wrap={false}>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
              <Text style={styles.inputLabel}>{item.label}</Text>
              {item.help ? <Text style={styles.metricHelp}>{t(item.help)}</Text> : null}
            </View>
            <Text style={styles.inputValue}>{t(item.value)}</Text>
          </View>
        ),
      )}
    </>
  );
}

/**
 * Scene with the same frame geometry as SystemScene (16:9, house at 11 %/66 %,
 * heat pump left, EV right, backup badge on the storage). Only components of
 * this calculation are drawn; the house alone is shown larger, as approved.
 */
function Scene({ scene, width }: { scene: PdfModel["scene"]; width: number }) {
  const hasComponents = scene.heatPump !== null || scene.ev || scene.backup;
  if (!hasComponents) {
    const inner = Math.max(120, width - 12);
    const height = inner * (1026 / 1533);
    return (
      <View style={{ backgroundColor: sceneSurface, padding: 6, alignItems: "center", width }}>
        <Image src={scene.src} style={{ width: inner, height }} />
      </View>
    );
  }
  const frameW = width;
  const frameH = (frameW * 9) / 16;
  const houseW = frameW * 0.66;
  const houseH = houseW * (1026 / 1533);
  const evW = frameW * 0.31;
  const evH = evW * (409 / 580);
  const hpW = frameW * 0.12;
  const hpH = hpW * (381 / 393);
  const badgeW = frameW * 0.028 * 1.6; // slightly larger than on screen so it prints
  const badgeH = badgeW * (72 / 64);
  const sceneAsset = (name: string) => pdfAsset("scene", name);
  return (
    <View
      style={{
        width: frameW,
        height: frameH,
        backgroundColor: sceneSurface,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Image
        src={scene.src}
        style={{
          position: "absolute",
          left: frameW * 0.11,
          bottom: frameH * 0.08,
          width: houseW,
          height: houseH,
        }}
      />
      {scene.heatPump === "luftwasser" ? (
        <Image
          src={sceneAsset("heat-pump-luftwasser-gray.png")}
          style={{
            position: "absolute",
            left: frameW * 0.08,
            bottom: frameH * 0.17,
            width: hpW,
            height: hpH,
          }}
        />
      ) : null}
      {scene.ev ? (
        <Image
          src={sceneAsset("ev-set-gray.png")}
          style={{
            position: "absolute",
            left: frameW * 0.65,
            bottom: frameH * 0.1,
            width: evW,
            height: evH,
          }}
        />
      ) : null}
      {scene.backup ? (
        <View
          style={{
            position: "absolute",
            left: frameW * 0.287 - (badgeW - frameW * 0.028) / 2,
            top: frameH * 0.73 - (badgeH - (frameW * 0.028 * 72) / 64) / 2,
            width: badgeW,
            height: badgeH,
          }}
        >
          <Svg width={badgeW} height={badgeH} viewBox="0 0 64 72">
            <Path
              d="M32 3.5 L56 12.5 V34 c0 16.5-10.8 28.2-24 34.2 C18.8 62.7 8 51 8 34 V12.5 Z"
              fill="#fbf9f3"
              stroke="#454942"
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Path d="M35.5 16 L22 36.5 h9.2 L27.2 55.5 44.5 33.2 h-9.4 Z" fill="#b77c28" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function SpeicherGrenzePdfDocument({ model }: { model: PdfModel }) {
  const balanceRows = [...model.balance.rowsLeft, ...model.balance.rowsRight];
  const chips = paginateChips(model.chips);

  return (
    <Document
      title="SpeicherGrenze – Ihre Speicher-Analyse"
      author="PVNavigator"
      language="de"
    >
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.pageHeader}>
          <Text style={styles.pageHeaderMark}>PVNAVIGATOR_</Text>
          <Text style={styles.pageHeaderMark}>SPEICHERGRENZE</Text>
        </View>
        <View fixed style={styles.footerRule} />
        <Link fixed style={styles.footerLink} src="https://speicher.pvnavigator.de">
          speicher.pvnavigator.de
        </Link>
        {model.layoutTest ? (
          <View fixed style={styles.testBanner}>
            <Text>{model.layoutTest.banner}</Text>
          </View>
        ) : null}

        {/* 1 · Cover: title + scene, compact facts, two results, Nutzen ---- */}
        <View wrap={false}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Ihr Haus.{"\n"}Ihr Verbrauch.{"\n"}Ihre Speichergröße.</Text>
              <Text style={[styles.address, { marginTop: 10 }]}>{model.address}</Text>
              <Text style={[styles.meta, { marginTop: 3 }]}>Gespeichert am {model.savedAt}</Text>
            </View>
            <View style={styles.heroScene}>
              <Scene scene={model.scene} width={CONTENT_W * 0.42} />
              <Text style={[styles.note, { marginTop: 5, textAlign: "center" }]}>
                {model.scene.caption}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <FactChips chips={chips.first} />
          </View>

          <View style={[styles.kpiPair, { marginTop: 16 }]}>
            <View style={styles.kpiCard}>
              <View style={styles.kpiValueRow}>
                <Text style={styles.kpiValuePrimary}>{t(model.technical.value)}</Text>
                <Text style={styles.kpiUnitPrimary}>{model.technical.unit}</Text>
              </View>
              <Text style={styles.kpiTitle}>Technische Speichergrenze</Text>
              <Text style={[styles.note, { marginTop: 3 }]}>{model.technical.caption}</Text>
            </View>
            <View style={styles.kpiCardSecondary}>
              <View style={styles.kpiValueRow}>
                <Text style={styles.kpiValueSecondary}>{t(model.planning.value)}</Text>
                <Text style={styles.kpiUnitSecondary}>{model.planning.unit}</Text>
              </View>
              <Text style={styles.kpiTitle}>Planerische Anfangskapazität</Text>
              <Text style={[styles.note, { marginTop: 3 }]}>{model.planning.caption}</Text>
            </View>
          </View>

          <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
            <View style={{ width: 3, height: 40, backgroundColor: accent }} />
            <View style={{ flexGrow: 1, flexBasis: 0, gap: 3 }}>
              <Text style={[styles.bodyStrong, { color: accent }]}>Warum diese Grenze?</Text>
              <Text style={styles.body}>
                Oberhalb dieser Kapazität nimmt der zusätzliche Eigenverbrauch nur noch langsam zu.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            <SectionHeading eyebrow="Nutzen" title="Was bringt Ihnen der Speicher?" />
            <View style={styles.blocks}>
              <View style={styles.two}>
                <BenefitColumn
                  title="Mehr Solarstrom selbst nutzen"
                  intro="Eigenverbrauch: Solarstrom, den Ihr Haushalt direkt oder über den Speicher nutzt."
                  rows={[
                    {
                      label: "Ohne Speicher",
                      value: model.benefit.ohneLabel,
                      bar: <EnergyBar fill={model.benefit.ohneFill} />,
                    },
                    {
                      label: "Mit Speicher",
                      value: model.benefit.mitLabel,
                      accent: true,
                      bar: <EnergyBar fill={model.benefit.mitFill} />,
                    },
                  ]}
                  scale={["0", model.benefit.scaleEnd]}
                  callout={model.benefit.gain}
                />
                <BenefitColumn
                  title="Weniger Strom aus dem Netz"
                  intro="Autarkie: Anteil Ihres Strombedarfs, den Ihre PV-Anlage deckt."
                  rows={[
                    {
                      label: "Ohne Speicher",
                      value: model.benefit.autarkieOhne,
                      bar: <AutarkieBar solar={model.benefit.solarOhne} />,
                    },
                    {
                      label: "Mit Speicher",
                      value: model.benefit.autarkieMit,
                      accent: true,
                      bar: <AutarkieBar solar={model.benefit.solarMit} />,
                    },
                  ]}
                  scale={[model.benefit.zeroPct, model.benefit.fullPct]}
                  callout={model.benefit.grid}
                  legend={
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.swatch, { backgroundColor: accent }]} />
                        <Text>Eigener Solarstrom</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.swatch, { backgroundColor: beige }]} />
                        <Text>Netzstrom</Text>
                      </View>
                    </View>
                  }
                />
              </View>
              <View style={{ flexDirection: "column", gap: 3 }}>
                {model.overviewNote ? <Text style={styles.note}>{model.overviewNote}</Text> : null}
                <Text style={styles.note}>{model.basisNote}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Continuation is decided only from the final chip list. An empty
            remainder draws neither the eyebrow nor an extra page. The heading
            stays with the first data row so it cannot sit alone at the bottom
            of the cover. */}
        {chips.restRows.length > 0 ? (
          <>
            <View wrap={false} style={styles.section}>
              <SectionHeading eyebrow="Eingaben" title="Eingaben — Fortsetzung" />
              <FactChips chips={chips.restRows[0].items} />
            </View>
            {chips.restRows.length > 1 ? (
              <View style={{ marginTop: CHIP_GAP }}>
                <FactChips
                  chips={chips.restRows.slice(1).flatMap((row) => row.items)}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {/* Speichergröße starts a page; the chart and short conclusion stay together. */}
        <View break style={styles.sectionStart} wrap={false}>
          <SectionHeading eyebrow="Speichergröße" title="Eigenverbrauch vs Speichergröße" />
          <View style={styles.blocks}>
            <Chart chart={model.chart} />
            <Text style={styles.body}>{t(model.chart.lead)}</Text>
          </View>
        </View>
        {/* Planning explanation: one short block (paragraph, formula, caveat). */}
        <View style={[styles.blocks, { marginTop: SP_BLOCK }]} wrap={false}>
          <Text style={styles.body}>{model.chart.ageing}</Text>
          <View style={styles.textBlock}>
            <Formula chart={model.chart} />
            <Text style={styles.caveat}>{model.chart.caveat}</Text>
            {model.chart.planningExceedsSimulatedRange ? (
              <Text style={[styles.callout, { backgroundColor: "#fdf4e7", color: chartMarker }]}>
                Die planerische Anfangskapazität liegt außerhalb des simulierten
                Speicherbereichs von 5–30 kWh.
              </Text>
            ) : null}
          </View>
        </View>

        {/* 5 · Robustheit ------------------------------------------------------- */}
        <View break style={styles.sectionStart}>
          <SectionHeading eyebrow="Robustheit" title="Haushaltsprofile" />
          <View style={styles.blocks}>
            <View style={styles.textBlock}>
              <Text style={styles.bodyStrong}>{model.robustness.lead}</Text>
              {model.robustness.follow ? (
                <Text style={styles.body}>{model.robustness.follow}</Text>
              ) : null}
            </View>
            <CompareTable {...model.robustness.compare} />
            <View style={styles.textBlock}>
              <SubHeading>{model.robustness.question}</SubHeading>
              <Text style={styles.note}>{model.robustness.hint}</Text>
              {model.robustness.explanation.map((paragraph) => (
                <Text key={paragraph} style={styles.body}>
                  {paragraph}
                </Text>
              ))}
              {model.robustness.appendixCount != null ? (
                <Text style={styles.body}>
                  {`Die Einzelergebnisse der ${model.robustness.appendixCount} Haushaltsprofile finden Sie in `}
                  <Link
                    src="#anhang-1"
                    style={[
                      styles.body,
                      { color: accent, textDecoration: "underline" },
                    ]}
                  >
                    Anhang 1
                  </Link>
                  .
                </Text>
              ) : null}
              <Text style={styles.note}>{model.robustness.stability}</Text>
            </View>
            {/* The distribution is a chart: bars and labels stay together. */}
            <View wrap={false}>
              <SubHeading>Verteilung der technischen Speichergrenze</SubHeading>
              {model.robustness.distribution.map((item) => (
                <View key={item.label} style={styles.distItem}>
                  <View style={styles.distLabel}>
                    <Text>{t(item.label)}</Text>
                    <Text style={{ color: secondary }}>{t(item.count)}</Text>
                  </View>
                  <View style={styles.distTrack}>
                    {item.width > 0 ? (
                      <View style={[styles.distFill, { width: `${item.width}%` }]} />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 6 · Bilanz: rows never split; the losses band is one small block ---- */}
        <View break style={styles.sectionStart}>
          <SectionHeading eyebrow="Bilanz" title="Technische Kennzahlen" />
          <View style={styles.blocks}>
            <View>
              <Text style={[styles.note, { marginBottom: 4 }]}>{model.balance.helper}</Text>
              {balanceRows.map((row) => (
                <MetricRow key={row.label} row={row} />
              ))}
            </View>
            {model.balance.losses ? (
              <View style={styles.band} wrap={false}>
                <View style={styles.metric}>
                  <View style={styles.metricLabel}>
                    <Text style={{ fontWeight: 600 }}>Batterieverluste gesamt</Text>
                    <Text style={styles.metricHelp}>{model.balance.losses.note}</Text>
                  </View>
                  <Text style={[styles.metricValue, { fontSize: 11.5 }]}>
                    {t(model.balance.losses.total)}
                  </Text>
                </View>
                {model.balance.losses.items.map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      styles.metric,
                      index === model.balance.losses!.items.length - 1
                        ? { borderBottomWidth: 0 }
                        : {},
                    ]}
                  >
                    <Text style={styles.metricLabel}>{item.label}</Text>
                    <Text style={styles.metricValue}>{t(item.value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* 7 · Methodik ----------------------------------------------------------- */}
        <View break style={styles.sectionStart}>
          <SectionHeading eyebrow="Methodik" title="Einschätzung, Grenzen und Quellen" />
          <View style={styles.blocks}>
            <View style={styles.textBlock}>
              {model.methodik.assessment.map((paragraph) => (
                <Text key={paragraph} style={styles.body}>
                  {paragraph}
                </Text>
              ))}
            </View>
            <View style={styles.textBlock}>
              <SubHeading>Grundsätze</SubHeading>
              {model.methodik.principles.map((item) => (
                <Text key={item} style={styles.body}>
                  {item}
                </Text>
              ))}
            </View>
            <View style={styles.textBlock}>
              <SubHeading>Quellen & wissenschaftliche Grundlagen</SubHeading>
              <Text style={styles.body}>
                Die ausführliche Dokumentation steht unter{" "}
                <Link style={[styles.link, { fontSize: 10.5 }]} src={model.methodik.methodikUrl}>
                  Methodik
                </Link>
                . Hier nur die Quellen, die dieser Bericht verwendet.
              </Text>
              {model.methodik.sources.map((source) => (
                <View key={source.title} wrap={false} style={{ marginTop: 4 }}>
                  <Text style={styles.sourceTitle}>{source.title}</Text>
                  {source.detail ? <Text style={styles.body}>{source.detail}</Text> : null}
                  {source.organization ? (
                    <Text style={styles.note}>{source.organization}</Text>
                  ) : null}
                  {source.url && source.linkLabel ? (
                    <Link style={[styles.link, { marginTop: 1 }]} src={source.url}>
                      {source.linkLabel}
                    </Link>
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={styles.note}>
              <Text style={{ fontWeight: 600 }}>Hinweis: </Text>
              {model.methodik.disclaimer}
            </Text>
          </View>
        </View>

        {/* Anhang always starts on its own page; the header repeats if the
            table continues, and a row is never split. */}
        <View break id="anhang-1" style={styles.sectionStart}>
          <SectionHeading eyebrow="Anhang 1" title={model.profiles.title} />
          <View>
            <ProfileHeader />
            {model.profiles.rows.map((row) => (
              <ProfileRow key={row.profil} row={row} />
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
