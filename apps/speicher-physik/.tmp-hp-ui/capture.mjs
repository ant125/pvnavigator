/**
 * One-off screenshot capture for the heat-pump UX phase.
 * Not part of the product. Do not commit.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function shot(page, name, selector) {
  const file = path.join(OUT, name);
  if (selector) {
    const el = await page.$(selector);
    if (!el) throw new Error(`Missing selector ${selector} for ${name}`);
    await el.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  console.log("wrote", name);
}

async function findByText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const handle of handles) {
    const t = (await page.evaluate((el) => el.textContent || "", handle)).trim();
    if (t.includes(text)) return handle;
  }
  return null;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--window-size=1280,1400"],
    defaultViewport: { width: 1280, height: 1400 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${BASE}/calculate`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() =>
    document.body.innerText.includes("Wärmepumpe vorhanden")
  );

  const hpBlock = await page.evaluateHandle(() => {
    const legend = [...document.querySelectorAll("legend")].find((el) =>
      (el.textContent || "").includes("Wärmepumpe vorhanden")
    );
    if (!legend) throw new Error("heat-pump legend missing");
    return legend.closest(".border-t") || legend.parentElement;
  });

  await hpBlock.asElement().screenshot({ path: path.join(OUT, "01-nein.png") });
  console.log("wrote 01-nein.png");

  const hpRadios = await page.$$('input[name="heatPumpEnabled"]');
  if (hpRadios.length < 2) throw new Error("heatPumpEnabled radios missing");
  await hpRadios[1].click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("legend")].some((el) =>
      (el.textContent || "").includes("Typ der Wärmepumpe")
    )
  );

  const hpAfterJa = await page.evaluateHandle(() => {
    const legend = [...document.querySelectorAll("legend")].find((el) =>
      (el.textContent || "").includes("Wärmepumpe vorhanden")
    );
    return legend.closest(".border-t") || legend.parentElement;
  });
  await hpAfterJa.asElement().screenshot({
    path: path.join(OUT, "02-ja-type.png"),
  });
  console.log("wrote 02-ja-type.png");

  const luft = await findByText(page, "label", "Luft/Wasser");
  if (!luft) throw new Error("Luft/Wasser label missing");
  await luft.click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Gemessenes ThermBuild-Referenzprofil")
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll("legend")].some((el) =>
      (el.textContent || "").includes("Wofür wird die Wärmepumpe verwendet")
    )
  );

  const hpUsage = await page.evaluateHandle(() => {
    const legend = [...document.querySelectorAll("legend")].find((el) =>
      (el.textContent || "").includes("Wärmepumpe vorhanden")
    );
    return legend.closest(".border-t") || legend.parentElement;
  });
  await hpUsage.asElement().screenshot({
    path: path.join(OUT, "03-usage.png"),
  });
  console.log("wrote 03-usage.png");

  if (process.argv.includes("--selector-only")) {
    await browser.close();
    return;
  }

  const dhw = await findByText(page, "label", "Heizung und Warmwasser");
  if (!dhw) throw new Error("usage option missing");
  await dhw.click();

  await page.evaluate(() => {
    const set = (placeholder, value) => {
      const input = document.querySelector(
        `input[placeholder="${placeholder}"]`
      );
      if (!input) throw new Error(`missing ${placeholder}`);
      const proto = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      );
      proto.set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("z.B. 10", "10");
    set("z.B. 80331", "80331");
    set("z.B. München", "München");
    set("z.B. Marienplatz", "Marienplatz");
    set("z.B. 1", "1");
    set("z.B. 4500", "4500");
    set("z. B. 5000", "5000");
  });

  await Promise.all([
    page.waitForFunction(
      () => document.body.innerText.includes("Berechnung läuft"),
      { timeout: 15000 }
    ),
    page.click('button[type="submit"]'),
  ]);

  await page.waitForFunction(
    () =>
      document.body.innerText.includes(
        "ThermBuild-Wärmepumpenprofil wird geladen"
      ) ||
      document.body.innerText.includes(
        "ThermBuild-Wärmepumpenprofil geladen"
      ),
    { timeout: 120000 }
  );
  await page.waitForSelector('section[aria-label="Berechnungsfortschritt"]');
  const progress = await page.$('section[aria-label="Berechnungsfortschritt"]');
  await progress.screenshot({ path: path.join(OUT, "04-loading-thermbuild.png") });
  console.log("wrote 04-loading-thermbuild.png");

  await page.waitForFunction(
    () => document.body.innerText.includes("Verwendung:"),
    { timeout: 180000 }
  );
  const reportHp = await page.evaluateHandle(() => {
    const dt = [...document.querySelectorAll("dt")].find((el) =>
      (el.textContent || "").includes("Typ der Wärmepumpe")
    );
    return dt?.closest("dl") || document.body;
  });
  await reportHp.asElement().screenshot({
    path: path.join(OUT, "05-report-inputs.png"),
  });
  console.log("wrote 05-report-inputs.png");

  const reportText = await page.evaluate(() => document.body.innerText);
  if (/ThermBuild|Fordatis|TwinHouse|Labor/i.test(reportText)) {
    throw new Error("Customer report still mentions ThermBuild/dataset terms");
  }

  await page.goto(`${BASE}/methodik-quellen#waermepumpe`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#waermepumpe");
  const chapter = await page.$("#waermepumpe");
  await chapter.screenshot({ path: path.join(OUT, "06-methodik-waermepumpe.png") });
  console.log("wrote 06-methodik-waermepumpe.png");

  await page.goto(`${BASE}/methodik-quellen#public-thermbuild`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#public-thermbuild");
  const quelle = await page.$("#public-thermbuild");
  await quelle.screenshot({
    path: path.join(OUT, "07-quellen-thermbuild.png"),
  });
  console.log("wrote 07-quellen-thermbuild.png");

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
