"use client";

import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
import { SpeicherInput } from "../types/speicher";
import {
  validateInput,
  type SpeicherFieldErrors,
  type SpeicherFieldErrorKey,
} from "../utils/validateInput";
import {
  type HouseholdCalculationPayload,
  type SpeicherGrenzPayload,
  type VerifiedResult,
  type WpuqRobustnessPayload,
  type WwRobustnessPayload,
} from "./actions";
import { CalculationProgressList } from "./CalculationProgressList";
import {
  CALCULATION_COMPLETE_PAUSE_MS,
  INITIAL_CALCULATION_PROGRESS,
  applyCalculationProgress,
} from "@/lib/calculationProgress";
import { runHouseholdCalculationStream } from "./runHouseholdCalculationStream";
import {
  useReportHeaderCta,
  type CalculateHeaderStatus,
} from "../components/headerCtaContext";
import { CalculatePageStatus } from "./CalculatePageStatus";
import { SpeicherReportView } from "../components/SpeicherReportView";
import { mapEvFormToCalculationInput } from "../utils/evForm";
import type { ReportHeatPumpCitation } from "@/lib/reportMethodologySources";
import {
  DEFAULT_SURFACE,
  INITIAL_FORM_DATA,
  surfacesOrDefault,
  sumSurfaceKwP,
} from "./calculateFormModel";
import {
  calculationInputFingerprint,
  calculationInputsAreStale,
} from "./calculationInputFingerprint";
import {
  FOCUS_FIELD_ORDER,
  SpeicherCalculateForm,
} from "./SpeicherCalculateForm";
import { SpeicherCalculateWorkspace } from "./SpeicherCalculateWorkspace";
import { InputSystemPreview } from "./InputSystemPreview";
import { RunSystemPreview } from "./RunSystemPreview";
import { CompletedCalculationRow } from "./CompletedCalculationRow";

type Step = "input" | "calculating" | "results";

const POSTAL_CODE_MISMATCH_GENERAL_MESSAGE =
  "Die eingegebene PLZ stimmt nicht mit der gefundenen Adresse überein. Bitte prüfen Sie die PLZ.";

export default function SpeicherCalculatePage() {
  const [step, setStep] = useState<Step>("input");
  const [editing, setEditing] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [calculatedFingerprint, setCalculatedFingerprint] = useState<
    string | null
  >(null);
  const [calculationProgress, setCalculationProgress] = useState(
    INITIAL_CALCULATION_PROGRESS
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [calculationComplete, setCalculationComplete] = useState(false);
  const [calculationDurationMs, setCalculationDurationMs] = useState<
    number | null
  >(null);
  const calculationStartedAtRef = useRef<number | null>(null);
  const submitInFlightRef = useRef(false);
  const pendingScrollToRunRef = useRef(false);
  const [runSceneOpen, setRunSceneOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<SpeicherFieldErrors>({});
  const [verifiedResult, setVerifiedResult] = useState<VerifiedResult | null>(
    null
  );
  const [speicherGrenz, setSpeicherGrenz] =
    useState<SpeicherGrenzPayload | null>(null);
  const [robustness, setRobustness] = useState<WpuqRobustnessPayload | null>(
    null
  );
  const [wasserWasserRobustness, setWasserWasserRobustness] =
    useState<WwRobustnessPayload | null>(null);
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);
  const [heatPumpCitation, setHeatPumpCitation] =
    useState<ReportHeatPumpCitation>(null);
  const [evResult, setEvResult] = useState<
    HouseholdCalculationPayload["ev"]
  >(null);
  const [resultPresentation, setResultPresentation] = useState<{
    surfaces: ReturnType<typeof surfacesOrDefault>;
    annualConsumptionKwh: number | undefined;
    heatPumpEnabled: boolean | undefined;
    heatPumpConsumptionKwh: number | undefined;
    heatPumpTechnology: SpeicherInput["heatPumpTechnology"];
    heatPumpDhwService: SpeicherInput["heatPumpDhwService"];
    evEnabled: boolean | undefined;
    backupReserveKwh: number | undefined;
    totalKwPConfigured: number;
  } | null>(null);
  const [runPreview, setRunPreview] = useState<Partial<SpeicherInput> | null>(
    null
  );
  const errorBoxRef = useRef<HTMLDivElement | null>(null);
  const mainPaneRef = useRef<HTMLDivElement | null>(null);
  const postalCodeInputRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const houseNumberInputRef = useRef<HTMLInputElement | null>(null);
  const annualConsumptionInputRef = useRef<HTMLInputElement | null>(null);

  const fieldInputRefs: Record<
    (typeof FOCUS_FIELD_ORDER)[number],
    RefObject<HTMLInputElement | null>
  > = {
    postalCode: postalCodeInputRef,
    city: cityInputRef,
    street: streetInputRef,
    houseNumber: houseNumberInputRef,
    annualConsumptionKwh: annualConsumptionInputRef,
  };

  const clearFieldError = (field: SpeicherFieldErrorKey) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [formData, setFormData] = useState<Partial<SpeicherInput>>({
    ...INITIAL_FORM_DATA,
    pvSurfaces: [{ ...DEFAULT_SURFACE }],
  });
  const [kwpInputStrings, setKwpInputStrings] = useState<string[]>([""]);
  const [azimuthInputStrings, setAzimuthInputStrings] = useState<string[]>([
    String(DEFAULT_SURFACE.azimuthDeg),
  ]);
  const [tiltInputStrings, setTiltInputStrings] = useState<string[]>([
    String(DEFAULT_SURFACE.tiltDeg),
  ]);

  const formLocked = step === "calculating" || (step === "results" && !editing);
  const isStale =
    Boolean(calculatedFingerprint) &&
    calculationInputsAreStale(formData, calculatedFingerprint);

  useEffect(() => {
    if (step !== "calculating" || calculationComplete) return;
    const startedAt = calculationStartedAtRef.current ?? Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, calculationComplete]);

  useEffect(() => {
    if (step !== "calculating") return;
    if (!pendingScrollToRunRef.current) return;

    const scrollFrame = requestAnimationFrame(() => {
      if (!pendingScrollToRunRef.current) return;
      pendingScrollToRunRef.current = false;
      mainPaneRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      mainPaneRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(scrollFrame);
  }, [step]);

  useEffect(() => {
    if (errors.length === 0 || formLocked) return;

    const scrollFrame = requestAnimationFrame(() => {
      errorBoxRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      requestAnimationFrame(() => {
        const firstInvalidField = FOCUS_FIELD_ORDER.find(
          (field) => fieldErrors[field]
        );
        if (firstInvalidField) {
          fieldInputRefs[firstInvalidField].current?.focus({
            preventScroll: true,
          });
        }
      });
    });

    return () => cancelAnimationFrame(scrollFrame);
  }, [errors, fieldErrors, formLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "calculating" || submitInFlightRef.current) return;

    const validation = validateInput(formData);
    if (!validation.isValid) {
      pendingScrollToRunRef.current = false;
      setErrors(validation.errors);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    submitInFlightRef.current = true;
    setErrors([]);
    setFieldErrors({});
    setCalculationProgress(INITIAL_CALCULATION_PROGRESS);
    setElapsedSeconds(0);
    setCalculationComplete(false);
    setCalculationDurationMs(null);
    calculationStartedAtRef.current = Date.now();
    setHeatPumpCitation(null);
    setEvResult(null);
    setWasserWasserRobustness(null);
    setEditing(false);
    setDetailsExpanded(true);
    setRunSceneOpen(false);
    pendingScrollToRunRef.current = true;
    setRunPreview({
      ...formData,
      pvSurfaces: surfacesOrDefault(formData),
    });
    setStep("calculating");

    try {
      const pvSurfaces = surfacesOrDefault(formData).map((s) => ({
        systemSizeKwP: s.systemSizeKwP,
        tiltDeg: s.tiltDeg,
        azimuthDeg: s.azimuthDeg,
      }));
      const totalKwP = sumSurfaceKwP(pvSurfaces);

      const response = await runHouseholdCalculationStream(
        {
          annualConsumptionKWh: formData.annualConsumptionKwh as number,
          pvSystemKwP: totalKwP,
          street: formData.street as string,
          houseNumber: formData.houseNumber as string,
          postalCode: formData.postalCode as string,
          city: formData.city as string,
          tiltDeg: pvSurfaces[0].tiltDeg,
          azimuthDeg: pvSurfaces[0].azimuthDeg,
          pvSurfaces,
          heatPumpEnabled: formData.heatPumpEnabled === true,
          heatPumpConsumptionKWh:
            formData.heatPumpEnabled === true
              ? formData.heatPumpConsumptionKwh
              : undefined,
          ...(formData.heatPumpEnabled === true
            ? {
                heatPumpTechnology: formData.heatPumpTechnology,
                heatPumpDhwService: formData.heatPumpDhwService,
              }
            : {}),
          ev: mapEvFormToCalculationInput(formData),
          backupReserveKwh: formData.backupReserveKwh,
        },
        (event) => {
          setCalculationProgress((prev) => applyCalculationProgress(prev, event));
        }
      );

      const startedAt = calculationStartedAtRef.current ?? Date.now();
      const durationMs = Date.now() - startedAt;
      setCalculationDurationMs(durationMs);
      setElapsedSeconds(Math.floor(durationMs / 1000));
      setCalculationComplete(true);
      setCalculatedFingerprint(calculationInputFingerprint(formData));

      setVerifiedResult(response.verifiedResult);
      setSpeicherGrenz(response.speicherGrenz);
      setRobustness(response.robustness);
      setWasserWasserRobustness(response.wasserWasserRobustness);
      setDisplayAddress(response.displayAddress);
      setHeatPumpCitation(
        response.heatPump
          ? { methodologySourceId: response.heatPump.methodologySourceId }
          : null
      );
      setEvResult(response.ev);
      setResultPresentation({
        surfaces: surfacesOrDefault(formData),
        annualConsumptionKwh: formData.annualConsumptionKwh,
        heatPumpEnabled: formData.heatPumpEnabled,
        heatPumpConsumptionKwh: formData.heatPumpConsumptionKwh,
        heatPumpTechnology: formData.heatPumpTechnology,
        heatPumpDhwService: formData.heatPumpDhwService,
        evEnabled: formData.evEnabled,
        backupReserveKwh: formData.backupReserveKwh,
        totalKwPConfigured: totalKwP,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, CALCULATION_COMPLETE_PAUSE_MS)
      );
      setDetailsExpanded(false);
      setStep("results");
    } catch (err) {
      pendingScrollToRunRef.current = false;
      const message =
        err instanceof Error
          ? err.message
          : "Die Berechnung ist fehlgeschlagen. Bitte versuchen Sie es erneut.";
      setErrors([message]);
      if (message === POSTAL_CODE_MISMATCH_GENERAL_MESSAGE) {
        setFieldErrors({ postalCode: "Bitte prüfen Sie die PLZ." });
      } else {
        setFieldErrors({});
      }
      setCalculationComplete(false);
      setCalculationDurationMs(null);
      calculationStartedAtRef.current = null;
      setEditing(false);
      setRunPreview(null);
      setRunSceneOpen(false);
      setStep("input");
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const handleReset = useCallback(() => {
    setStep("input");
    setEditing(false);
    setDetailsExpanded(false);
    setCalculatedFingerprint(null);
    setVerifiedResult(null);
    setSpeicherGrenz(null);
    setRobustness(null);
    setWasserWasserRobustness(null);
    setDisplayAddress(null);
    setHeatPumpCitation(null);
    setEvResult(null);
    setResultPresentation(null);
    setRunPreview(null);
    setRunSceneOpen(false);
    pendingScrollToRunRef.current = false;
    setCalculationComplete(false);
    setCalculationDurationMs(null);
    calculationStartedAtRef.current = null;
    setElapsedSeconds(0);
    setErrors([]);
    setFieldErrors({});
    setCalculationProgress(INITIAL_CALCULATION_PROGRESS);
    setFormData({
      ...INITIAL_FORM_DATA,
      pvSurfaces: [{ ...DEFAULT_SURFACE }],
    });
    setKwpInputStrings([""]);
    setAzimuthInputStrings([String(DEFAULT_SURFACE.azimuthDeg)]);
    setTiltInputStrings([String(DEFAULT_SURFACE.tiltDeg)]);
  }, []);

  useReportHeaderCta(handleReset, step === "results");

  const pageStatus: CalculateHeaderStatus =
    step === "calculating"
      ? "calculating"
      : step === "results" && editing && isStale
        ? "stale"
        : step === "results" && editing
          ? "editing"
          : step === "results"
            ? "complete"
            : "input";

  const previewForm = step === "input" ? formData : (runPreview ?? formData);
  const includeHeatPumpProfile =
    previewForm.heatPumpEnabled === true &&
    (previewForm.heatPumpTechnology === "luftwasser" ||
      previewForm.heatPumpTechnology === "wasserwasser")
      ? previewForm.heatPumpTechnology
      : false;
  const includeEvProfile = previewForm.evEnabled === true;

  const runPreviewCard = (
    <RunSystemPreview
      formData={runPreview ?? formData}
      sceneOpen={runSceneOpen}
      onToggleScene={() => setRunSceneOpen((open) => !open)}
    />
  );

  const progress = (
    <CalculationProgressList
      progress={calculationProgress}
      elapsedSeconds={elapsedSeconds}
      complete={calculationComplete}
      includeHeatPumpProfile={includeHeatPumpProfile}
      includeEvProfile={includeEvProfile}
    />
  );

  const report =
    step === "results" && verifiedResult && resultPresentation ? (
      <div
        className={
          editing
            ? isStale
              ? "pointer-events-none opacity-[0.72]"
              : "opacity-80"
            : ""
        }
        aria-hidden={isStale || undefined}
      >
        <SpeicherReportView
          mode="live"
          variant="workspace"
          verifiedResult={verifiedResult}
          speicherGrenz={speicherGrenz}
          robustness={robustness}
          wasserWasserRobustness={wasserWasserRobustness}
          ev={evResult}
          heatPumpCitation={heatPumpCitation}
          displayAddress={displayAddress}
          surfaces={resultPresentation.surfaces}
          input={{
            annualConsumptionKwh: resultPresentation.annualConsumptionKwh,
            heatPumpEnabled: resultPresentation.heatPumpEnabled,
            heatPumpConsumptionKwh: resultPresentation.heatPumpConsumptionKwh,
            heatPumpTechnology: resultPresentation.heatPumpTechnology,
            heatPumpDhwService: resultPresentation.heatPumpDhwService,
            evEnabled: resultPresentation.evEnabled,
            backupReserveKwh: resultPresentation.backupReserveKwh,
          }}
          totalKwPConfigured={resultPresentation.totalKwPConfigured}
          calculationDurationMs={calculationDurationMs}
        />
      </div>
    ) : null;

  let main: React.ReactNode;
  if (step === "input") {
    main = <InputSystemPreview formData={formData} />;
  } else {
    main = (
      <div
        ref={mainPaneRef}
        tabIndex={-1}
        aria-label={step === "calculating" ? "Berechnung" : "Ergebnis"}
        className="sg-run-focus space-y-6 scroll-mt-sg-sticky"
      >
        {runPreviewCard}
        {step === "calculating" ? (
          progress
        ) : (
          <>
            {isStale ? (
              <div
                role="status"
                className="rounded-sm border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
              >
                Eingaben geändert — Ergebnis nicht aktuell.
              </div>
            ) : null}
            <CompletedCalculationRow
              durationMs={calculationDurationMs}
              expanded={detailsExpanded}
              onToggle={() => setDetailsExpanded((open) => !open)}
            >
              {progress}
            </CompletedCalculationRow>
            {report}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 px-layout-gap pb-3 pt-5">
      <div className="mb-title-section-gap flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <h1 className="text-[1.875rem] font-semibold leading-none tracking-tight text-ink sm:text-[2.375rem] lg:text-[2.875rem]">
            Ihre Speicher-Analyse
          </h1>
          <p className="mt-1.5 text-[1.125rem] font-medium leading-snug text-ink-secondary">
            Technische Analyse
          </p>
        </div>
        <CalculatePageStatus status={pageStatus} />
      </div>

      <SpeicherCalculateWorkspace
        formLocked={formLocked}
        pinMain={step === "input"}
        collapseFormOnMobile={false}
        form={
          <SpeicherCalculateForm
            formData={formData}
            setFormData={setFormData}
            kwpInputStrings={kwpInputStrings}
            setKwpInputStrings={setKwpInputStrings}
            azimuthInputStrings={azimuthInputStrings}
            setAzimuthInputStrings={setAzimuthInputStrings}
            tiltInputStrings={tiltInputStrings}
            setTiltInputStrings={setTiltInputStrings}
            errors={errors}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
            locked={formLocked}
            submitLabel={
              calculatedFingerprint ? "Neu berechnen" : "Berechnung starten"
            }
            showSubmit={!formLocked}
            onSubmit={handleSubmit}
            onEditInputs={
              step === "results" && formLocked
                ? () => setEditing(true)
                : undefined
            }
            errorBoxRef={errorBoxRef}
            fieldInputRefs={fieldInputRefs}
          />
        }
        main={main}
      />
    </div>
  );
}
