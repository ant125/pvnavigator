import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SpeicherCalculateWorkspace,
  pinnedFormMaxHeightPx,
} from "./SpeicherCalculateWorkspace";

describe("SpeicherCalculateWorkspace pinMain", () => {
  it("stretches the result column only when the input preview should stick", () => {
    const pinned = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form</div>}
        main={<div>preview</div>}
        pinMain
      />
    );
    const unpinned = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form</div>}
        main={<div>preview</div>}
      />
    );

    expect(pinned).toContain("lg:self-stretch");
    expect(unpinned).not.toContain("lg:self-stretch");
  });

  it("keeps the input form in the page and opens a panel only after calculation", () => {
    const input = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form-body</div>}
        main={<div>preview</div>}
      />
    );
    const result = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form-body</div>}
        main={<div>report</div>}
        pinForm
      />
    );

    expect(input).toContain("form-body");
    expect(input).toContain("overflow-visible");
    expect(input).not.toContain("Eingabedaten anzeigen");
    expect(result).toContain("form-body");
    expect(result).toContain("Eingabedaten anzeigen");
    expect(result).toContain("sg-form-pin");
    expect(result).not.toContain("Einklappen");
    expect(result).not.toContain("WÄRMEPUMPE · JA");
  });

  it("uses aligned column header bars and a tighter desktop gutter", () => {
    const html = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form-body</div>}
        main={<div>preview</div>}
        collapseFormOnMobile={false}
      />
    );

    expect(html).toContain("lg:gap-column-gap");
    expect(html).not.toContain("lg:gap-4");
    expect(html).not.toContain("lg:gap-8");
    expect(html).toContain("01");
    expect(html).toContain("Eingabedaten");
    expect(html).not.toContain("01 /");
    expect(html).not.toContain("Eingabedaten anzeigen");
    expect(html).toContain("bg-accent");
    expect(html).toContain(
      "font-mono text-base font-bold uppercase leading-none tracking-[0.08em] text-white"
    );
    expect(html).toContain("px-3.5 py-2.5");
    expect(html).toContain("rounded-none border border-line bg-surface overflow-visible");
    expect(html).not.toContain("rounded-t-sm");
    expect(html).not.toContain("bg-surface-muted/60");
  });

  it("pins the form column after a calculation", () => {
    const html = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form</div>}
        main={<div>report</div>}
        pinForm
        mainColumnHeading={{ number: "02", label: "Ergebnis" }}
      />
    );

    expect(html).toContain("sg-form-pin");
    expect(html).toContain("sg-form-pin-body");
  });

  it("puts a result-state column header on the right pane only when asked", () => {
    const withHeading = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form</div>}
        main={<div>report</div>}
        collapseFormOnMobile={false}
        mainColumnHeading={{ number: "02", label: "Ergebnis" }}
      />
    );
    const withoutHeading = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form</div>}
        main={<div>report</div>}
        collapseFormOnMobile={false}
      />
    );

    expect(withHeading).toContain("<span>02</span>");
    expect(withHeading).toContain("<span>Ergebnis</span>");
    expect(withHeading.indexOf("02")).toBeLessThan(
      withHeading.indexOf("report")
    );
    expect(withoutHeading).not.toContain("<span>Ergebnis</span>");
  });

  it("keeps the pinned form inside the visible window above and after it sticks", () => {
    expect(
      pinnedFormMaxHeightPx({
        panelTop: 220,
        stickyTop: 72,
        viewportHeight: 900,
        bottomGap: 20,
        minHeight: 256,
      })
    ).toBe(660);
    expect(
      pinnedFormMaxHeightPx({
        panelTop: 72,
        stickyTop: 72,
        viewportHeight: 900,
        bottomGap: 20,
        minHeight: 256,
      })
    ).toBe(808);
    expect(
      pinnedFormMaxHeightPx({
        panelTop: 12,
        stickyTop: 72,
        viewportHeight: 900,
        bottomGap: 20,
        minHeight: 256,
      })
    ).toBe(808);
  });
});
