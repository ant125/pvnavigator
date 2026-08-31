/**
 * One-off screenshots: report Quellen + Berechnungsdauer with/without HP.
 * Not part of the product.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function fillCommon(page) {
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
  });
}

async function screenshotQuellenAndDuration(page, prefix) {
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Quellen & wissenschaftliche Grundlagen"),
    { timeout: 180000 }
  );
  const quellen = await page.$("#report-quellen-heading");
  const quellenSection = await page.evaluateHandle((heading) => {
    return heading?.closest("section") ?? document.body;
  }, quellen);
  await quellenSection.asElement().screenshot({
    path: path.join(OUT, `${prefix}-quellen.png`),
  });
  console.log("wrote", `${prefix}-quellen.png`);

  const duration = await page.evaluateHandle(() => {
    const p = [...document.querySelectorAll("p")].find((el) =>
      (el.textContent || "").trim().startsWith("Berechnungsdauer")
    );
    return p?.parentElement ?? document.body;
  });
  await duration.asElement().screenshot({
    path: path.join(OUT, `${prefix}-dauer.png`),
  });
  console.log("wrote", `${prefix}-dauer.png`);
  return page.evaluate(() => document.body.innerText);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--window-size=1280,1600"],
    defaultViewport: { width: 1280, height: 1600 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);

  await page.goto(`${BASE}/calculate`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    document.body.innerText.includes("Wärmepumpe vorhanden")
  );

  if (process.argv.includes("--nohp-only")) {
    await fillCommon(page);
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Berechnung läuft") ||
        document.body.innerText.includes("Bitte korrigieren"),
      { timeout: 15000 }
    );
    const afterNoHp = await page.evaluate(() => document.body.innerText);
    if (afterNoHp.includes("Bitte korrigieren")) {
      throw new Error(`no-HP validation failed:\n${afterNoHp.slice(0, 2500)}`);
    }
    const withoutHp = await screenshotQuellenAndDuration(page, "09-report-nohp");
    if (withoutHp.includes("ThermBuild")) {
      throw new Error("No-HP report still mentions ThermBuild");
    }
    if (withoutHp.includes("Wärmepumpenprofil")) {
      throw new Error("No-HP report still mentions Wärmepumpenprofil");
    }
    await browser.close();
    return;
  }

  const hpRadios = await page.$$('input[name="heatPumpEnabled"]');
  await hpRadios[1].click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("legend")].some((el) =>
      (el.textContent || "").includes("Typ der Wärmepumpe")
    )
  );
  await page.click('input[name="heatPumpTechnology"]');
  await page.waitForFunction(() =>
    (document.body.innerText || "").includes(
      "Wofür wird die Wärmepumpe verwendet"
    )
  );
  const dhwRadios = await page.$$('input[name="heatPumpDhwService"]');
  const dhwAndHotWater = dhwRadios[dhwRadios.length - 1];
  await dhwAndHotWater.click();
  await fillCommon(page);
  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="z. B. 5000"]');
    if (!input) throw new Error("missing HP consumption");
    const proto = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    proto.set.call(input, "5000");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Berechnung läuft") ||
      document.body.innerText.includes("Bitte korrigieren"),
    { timeout: 15000 }
  );
  const afterFirst = await page.evaluate(() => document.body.innerText);
  if (afterFirst.includes("Bitte korrigieren")) {
    throw new Error(`HP validation failed:\n${afterFirst.slice(0, 2500)}`);
  }

  const withHp = await screenshotQuellenAndDuration(page, "08-report-hp");
  if (!withHp.includes("ThermBuild Wärmepumpen-Messdaten")) {
    throw new Error("Luft/Wasser report missing ThermBuild Quellen entry");
  }
  if (!withHp.includes("gemessenes Wärmepumpenprofil")) {
    throw new Error("Luft/Wasser report missing duration heat-pump item");
  }

  const reset = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) =>
      (el.textContent || "").includes("Neue Berechnung")
    )
  );
  await reset.asElement().click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Wärmepumpe vorhanden")
  );
  const hpOff = await page.$$('input[name="heatPumpEnabled"]');
  await hpOff[0].click();
  await fillCommon(page);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Berechnung läuft") ||
      document.body.innerText.includes("Bitte korrigieren"),
    { timeout: 15000 }
  );
  const afterSecond = await page.evaluate(() => document.body.innerText);
  if (afterSecond.includes("Bitte korrigieren")) {
    throw new Error(`no-HP validation failed:\n${afterSecond.slice(0, 2500)}`);
  }

  const withoutHp = await screenshotQuellenAndDuration(page, "09-report-nohp");
  if (withoutHp.includes("ThermBuild")) {
    throw new Error("No-HP report still mentions ThermBuild");
  }
  if (withoutHp.includes("Wärmepumpenprofil")) {
    throw new Error("No-HP report still mentions Wärmepumpenprofil");
  }

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
