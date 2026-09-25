// @vitest-environment jsdom
import { createRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { SpeicherInput } from "../types/speicher";
import { DEFAULT_SURFACE } from "./calculateFormModel";
import {
  SpeicherCalculateForm,
  type CalculateFormFieldRefs,
} from "./SpeicherCalculateForm";

/*
  No act() around the clicks on purpose: act() defers React's work, while the
  browser re-renders right after the click. The regression was that one shared
  DOM node served both buttons, so the submit button inherited focus from the
  edit button and the next Enter, Space or click started a calculation.
*/

const nextFrame = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

async function waitFor(condition: () => boolean, label: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) return;
    await nextFrame();
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function emptyRefs(): CalculateFormFieldRefs {
  return {
    postalCode: createRef<HTMLInputElement>(),
    city: createRef<HTMLInputElement>(),
    street: createRef<HTMLInputElement>(),
    houseNumber: createRef<HTMLInputElement>(),
    annualConsumptionKwh: createRef<HTMLInputElement>(),
  };
}

/**
 * Mirrors the /calculate wiring in the finished-result state: the form is
 * locked, "Eingaben bearbeiten" unlocks it, and only the submit button may
 * start a calculation.
 */
function ResultStateForm({
  onCalculate,
}: {
  onCalculate: (formData: Partial<SpeicherInput>) => void;
}) {
  const [formData, setFormData] = useState<Partial<SpeicherInput>>({
    pvSurfaces: [{ ...DEFAULT_SURFACE, systemSizeKwP: 10 }],
    postalCode: "86154",
    city: "Augsburg",
    street: "Branderstraße",
    houseNumber: "44",
    annualConsumptionKwh: 4500,
  });
  const [editing, setEditing] = useState(false);
  const locked = !editing;

  return (
    <SpeicherCalculateForm
      formData={formData}
      setFormData={setFormData}
      kwpInputStrings={["10"]}
      setKwpInputStrings={() => {}}
      azimuthInputStrings={["180"]}
      setAzimuthInputStrings={() => {}}
      tiltInputStrings={["30"]}
      setTiltInputStrings={() => {}}
      errors={[]}
      fieldErrors={{}}
      clearFieldError={() => {}}
      locked={locked}
      submitLabel="Neu berechnen"
      showSubmit={!locked}
      fieldsScrollable
      onSubmit={(event) => {
        event.preventDefault();
        onCalculate(formData);
      }}
      onEditInputs={locked ? () => setEditing(true) : undefined}
      errorBoxRef={
        createRef<HTMLDivElement>() as RefObject<HTMLDivElement | null>
      }
      fieldInputRefs={emptyRefs()}
    />
  );
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  flushSync(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function mount(onCalculate: (formData: Partial<SpeicherInput>) => void) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(<ResultStateForm onCalculate={onCalculate} />);
  });
  return container;
}

function buttonByText(scope: HTMLElement, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text
  );
  if (!button) throw new Error(`Button "${text}" not found`);
  return button;
}

function typeInto(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Eingaben bearbeiten", () => {
  it("unlocks the fields without starting a calculation", async () => {
    const calculations: Array<Partial<SpeicherInput>> = [];
    const scope = mount((formData) => calculations.push(formData));

    expect(scope.querySelector("fieldset")?.disabled).toBe(true);

    const editButton = buttonByText(scope, "Eingaben bearbeiten");
    expect(editButton.type).toBe("button");

    editButton.click();
    await nextFrame();

    expect(calculations).toHaveLength(0);
    expect(scope.querySelector("fieldset")?.disabled).toBe(false);

    const submitButton = buttonByText(scope, "Neu berechnen");
    expect(submitButton).not.toBe(editButton);

    await waitFor(
      () => document.activeElement?.id === "postalCode",
      "focus to move into the first field"
    );
    expect(document.activeElement).not.toBe(submitButton);
  });

  it("runs exactly one calculation with the edited values on the next submit", async () => {
    const calculations: Array<Partial<SpeicherInput>> = [];
    const scope = mount((formData) => calculations.push(formData));

    buttonByText(scope, "Eingaben bearbeiten").click();
    await nextFrame();

    const consumption = scope.querySelector<HTMLInputElement>(
      "#annualConsumptionKwh"
    );
    if (!consumption) throw new Error("Hausverbrauch field not found");
    typeInto(consumption, "5200");
    await nextFrame();

    buttonByText(scope, "Neu berechnen").click();
    await nextFrame();

    expect(calculations).toHaveLength(1);
    expect(calculations[0].annualConsumptionKwh).toBe(5200);
  });
});
