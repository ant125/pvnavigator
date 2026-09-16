import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SpeicherCalculateWorkspace } from "./SpeicherCalculateWorkspace";

describe("SpeicherCalculateWorkspace pinMain", () => {
  it("stretches the result column only when the input preview should stick", () => {
    const pinned = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form</div>}
        main={<div>preview</div>}
        formLocked={false}
        collapseFormOnMobile={false}
        pinMain
      />
    );
    const unpinned = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form</div>}
        main={<div>preview</div>}
        formLocked
        collapseFormOnMobile={false}
      />
    );

    expect(pinned).toContain("lg:self-stretch");
    expect(unpinned).not.toContain("lg:self-stretch");
  });

  it("keeps the form visible when mobile collapse is not requested", () => {
    const html = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form-body</div>}
        main={<div>preview</div>}
        formLocked
        collapseFormOnMobile={false}
      />
    );

    expect(html).toContain("form-body");
    expect(html).toContain("lg:block");
    expect(html).not.toContain("hidden p-4");
    expect(html).toContain("p-panel-gap lg:block");
  });

  it("uses aligned column header bars and a tighter desktop gutter", () => {
    const html = renderToStaticMarkup(
      <SpeicherCalculateWorkspace
        form={<div>form-body</div>}
        main={<div>preview</div>}
        formLocked
        collapseFormOnMobile={false}
      />
    );

    expect(html).toContain("lg:gap-column-gap");
    expect(html).not.toContain("lg:gap-4");
    expect(html).not.toContain("lg:gap-8");
    expect(html).toContain("01");
    expect(html).toContain("Eingabedaten");
    expect(html).not.toContain("01 /");
    expect(html).toContain("Einklappen");
    expect(html).toContain("bg-accent");
    expect(html).toContain(
      "font-mono text-lg font-semibold uppercase tracking-[0.08em] text-white"
    );
    expect(html).toContain("px-3.5 py-2");
    expect(html).toContain(
      "min-w-0 overflow-visible rounded-none border border-line bg-surface"
    );
    expect(html).not.toContain("rounded-t-sm");
    expect(html).toContain("bg-surface-muted/60");
  });
});
