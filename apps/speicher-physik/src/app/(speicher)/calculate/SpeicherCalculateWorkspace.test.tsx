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
  });
});
