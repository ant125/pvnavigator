import { describe, expect, it } from "vitest";

import {
  filenameFromContentDisposition,
  pdfContentDisposition,
  pdfDownloadFilename,
} from "./pdfDownload";

const address = {
  street: "Branderstraße",
  houseNumber: "44",
  postalCode: "86154",
  city: "Augsburg",
  displayAddress: "Branderstraße 44, 86154 Augsburg",
};

describe("pdfDownloadFilename", () => {
  it("names a company report after the client saved with the calculation", () => {
    expect(
      pdfDownloadFilename({
        ...address,
        reportAttribution: {
          companyName: "Sonnenwerk GmbH",
          clientGivenName: "Andrey",
          clientFamilyName: "Nachname",
        },
      }),
    ).toBe("SPEICHERGRENZE - Andrey Nachname.pdf");
  });

  it("names a private report after the street and house number", () => {
    expect(pdfDownloadFilename(address)).toBe("SPEICHERGRENZE - Branderstraße 44.pdf");
  });

  it("uses the stored address for an older report without a client name", () => {
    const older = {
      street: "Musterstraße",
      houseNumber: "1",
      displayAddress: "Musterstraße 1, 80331 München",
    };
    expect(pdfDownloadFilename(older)).toBe("SPEICHERGRENZE - Musterstraße 1.pdf");
    expect(pdfDownloadFilename(older)).toBe(pdfDownloadFilename(older));
  });

  it("reads a second download from the same stored row, not a later profile", () => {
    const stored = {
      ...address,
      reportAttribution: {
        companyName: "Sonnenwerk GmbH",
        clientGivenName: "Anna",
        clientFamilyName: "Schmidt",
      },
    };
    const first = pdfDownloadFilename(stored);
    const second = pdfDownloadFilename({
      ...stored,
      reportAttribution: {
        ...(stored.reportAttribution),
      },
    });
    expect(first).toBe("SPEICHERGRENZE - Anna Schmidt.pdf");
    expect(second).toBe(first);
  });

  it("falls back to the address when the stored client name is incomplete", () => {
    expect(
      pdfDownloadFilename({
        ...address,
        reportAttribution: { companyName: "Sonnenwerk GmbH", clientGivenName: "Anna" },
      }),
    ).toBe("SPEICHERGRENZE - Branderstraße 44.pdf");
  });

  it("keeps German letters and drops characters a file name cannot contain", () => {
    expect(
      pdfDownloadFilename({
        street: 'Müller:Weg/Ost',
        houseNumber: '12*a?',
      }),
    ).toBe("SPEICHERGRENZE - MüllerWegOst 12a.pdf");
  });

  it("uses the street line of a display address when the fields are absent", () => {
    expect(
      pdfDownloadFilename({
        displayAddress: "Sehr langer Weg 128a, 86154 Augsburg-Oberhausen, Bayern",
      }),
    ).toBe("SPEICHERGRENZE - Sehr langer Weg 128a.pdf");
  });

  it("round-trips the umlaut name through the download header", () => {
    const filename = pdfDownloadFilename(address);
    const header = pdfContentDisposition(filename);
    expect(header).toContain('filename="SPEICHERGRENZE - Branderstrasse 44.pdf"');
    expect(filenameFromContentDisposition(header)).toBe(
      "SPEICHERGRENZE - Branderstraße 44.pdf",
    );
  });
});
