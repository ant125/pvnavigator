import { readFileSync } from "node:fs";

import { renderToBuffer } from "@react-pdf/renderer";
import * as fontkit from "fontkit";
import { PDFDocument, rgb } from "pdf-lib";

import { pdfAsset } from "./pdfAssets";
import { PDF_DOWNLOAD_FILENAME } from "./pdfDownload";
import {
  SpeicherGrenzePdfDocument,
  type PdfModel,
} from "./reportDocument";

export { PDF_DOWNLOAD_FILENAME };

const MM = 72 / 25.4;
const PAGE_NUMBER_SIZE = 8;
// Same ink as the sample footer: #5c5a52.
const PAGE_NUMBER_COLOR = rgb(92 / 255, 90 / 255, 82 / 255);

/**
 * react-pdf's dynamic page label is dropped on the second layout pass.
 * The agreed footer number is drawn afterwards with the same Plex file,
 * without rewriting the page and without removing link annotations.
 */
async function stampPageNumbers(pdf: Buffer): Promise<Buffer> {
  const document = await PDFDocument.load(pdf);
  document.registerFontkit(
    fontkit as unknown as Parameters<PDFDocument["registerFontkit"]>[0],
  );
  const font = await document.embedFont(
    readFileSync(pdfAsset("fonts", "IBMPlexMono-Regular.ttf")),
  );
  const pages = document.getPages();
  const total = pages.length;
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${total}`;
    const width = font.widthOfTextAtSize(label, PAGE_NUMBER_SIZE);
    page.drawText(label, {
      x: page.getWidth() - 20 * MM - width,
      y: 9 * MM - 1,
      size: PAGE_NUMBER_SIZE,
      font,
      color: PAGE_NUMBER_COLOR,
    });
  });
  return Buffer.from(await document.save());
}

export async function renderSpeicherPdf(model: PdfModel): Promise<Buffer> {
  const output = await renderToBuffer(
    <SpeicherGrenzePdfDocument model={model} />,
  );
  return stampPageNumbers(Buffer.from(output));
}
