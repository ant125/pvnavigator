"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import type { ReportAccessKind } from "@pv-access/core";
import { getHubOrigin } from "@pv-auth/session";

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
  CalculationNoticeError,
  type CalculationNotice,
  type PinnedAddressFields,
} from "./calculationNotice";
import {
  clearCalculateDraft,
  readCalculateDraft,
  writeCalculateDraft,
} from "./calculateDraft";
import {
  useReportHeaderCta,
  type CalculateHeaderStatus,
} from "../components/headerCtaContext";
import { CalculatePageStatus } from "./CalculatePageStatus";
import { SpeicherReportView } from "../components/SpeicherReportView";
import type { ReportHeatPumpCitation } from "@/lib/reportMethodologySources";
import {
  DEFAULT_SURFACE,
  INITIAL_FORM_DATA,
  surfacesOrDefault,
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
import { buildHouseholdCalculationInput } from "./householdCalculationInput";
import { ResultNavigation } from "./ResultNavigation";
import { scrollPageToTop } from "./scrollPageToTop";
import { SelectedSystemChips } from "./SelectedSystemChips";
import { SystemScene, systemSceneFromForm } from "./SystemScene";
import {
  savedInputGapIsOpen,
  type SavedCalculationView,
} from "./savedCalculationForm";
import type { FrozenSpeicherPresentation } from "@/lib/persistCompletedCalculation";

type Step = "input" | "calculating" | "results";

const TARIFFS_URL = `${getHubOrigin()}/tarife`;

const POSTAL_CODE_MISMATCH_GENERAL_MESSAGE =
  "Die eingegebene PLZ stimmt nicht mit der gefundenen Adresse überein. Bitte prüfen Sie die PLZ.";

export default function SpeicherCalculatePage({
  saved = null,
}: {
  /** Set on /result/[id]. Viewing this snapshot does not start a calculation. */
  saved?: SavedCalculationView | null;
}) {
  const router = useRouter();
  const savedForm = saved?.hydrated.formData;
  const [step, setStep] = useState<Step>(saved ? "results" : "input");
  const [editing, setEditing] = useState(false);
  const [calculatedFingerprint, setCalculatedFingerprint] = useState<
    string | null
  >(() => (savedForm ? calculationInputFingerprint(savedForm) : null));
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
  /** Server refusal that is not an input mistake (service down, access rule). */
  const [notice, setNotice] = useState<CalculationNotice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SpeicherFieldErrors>({});
  const [verifiedResult, setVerifiedResult] = useState<VerifiedResult | null>(
    saved?.verifiedResult ?? null
  );
  const [speicherGrenz, setSpeicherGrenz] =
    useState<SpeicherGrenzPayload | null>(saved?.speicherGrenz ?? null);
  const [robustness, setRobustness] = useState<WpuqRobustnessPayload | null>(
    saved?.robustness ?? null
  );
  const [wasserWasserRobustness, setWasserWasserRobustness] =
    useState<WwRobustnessPayload | null>(
      saved?.wasserWasserRobustness ?? null
    );
  const [displayAddress, setDisplayAddress] = useState<string | null>(
    saved?.displayAddress ?? null
  );
  const [heatPumpCitation, setHeatPumpCitation] =
    useState<ReportHeatPumpCitation>(saved?.heatPumpCitation ?? null);
  const [evResult, setEvResult] = useState<
    HouseholdCalculationPayload["ev"]
  >(saved?.ev ?? null);
  const [completedCalculationId, setCompletedCalculationId] = useState<
    string | null
  >(saved?.id ?? null);
  const [completedAccessTier, setCompletedAccessTier] =
    useState<ReportAccessKind | null>(saved?.accessKind ?? null);
  const [presentationOverride, setPresentationOverride] =
    useState<FrozenSpeicherPresentation | null>(
      saved?.presentationOverride ?? null
    );
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
  } | null>(
    saved
      ? {
          surfaces: saved.hydrated.surfaces.map((surface) => ({ ...surface })),
          annualConsumptionKwh: saved.hydrated.annualConsumptionKwh,
          heatPumpEnabled: saved.hydrated.heatPumpEnabled,
          heatPumpConsumptionKwh: saved.hydrated.heatPumpConsumptionKwh,
          heatPumpTechnology: saved.hydrated.heatPumpTechnology,
          heatPumpDhwService: saved.hydrated.heatPumpDhwService,
          evEnabled: saved.hydrated.evEnabled,
          backupReserveKwh: saved.hydrated.backupReserveKwh,
          totalKwPConfigured: saved.hydrated.totalKwPConfigured,
        }
      : null
  );
  const [runPreview, setRunPreview] = useState<Partial<SpeicherInput> | null>(
    () =>
      savedForm
        ? {
            ...savedForm,
            pvSurfaces: savedForm.pvSurfaces?.map((surface) => ({ ...surface })),
          }
        : null
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

  const [formData, setFormData] = useState<Partial<SpeicherInput>>(() =>
    savedForm
      ? {
          ...savedForm,
          pvSurfaces: savedForm.pvSurfaces?.map((surface) => ({ ...surface })),
        }
      : {
          ...INITIAL_FORM_DATA,
          pvSurfaces: [{ ...DEFAULT_SURFACE }],
        }
  );
  const [kwpInputStrings, setKwpInputStrings] = useState<string[]>(
    saved?.hydrated.kwpInputStrings ?? [""]
  );
  const [azimuthInputStrings, setAzimuthInputStrings] = useState<string[]>(
    saved?.hydrated.azimuthInputStrings ?? [String(DEFAULT_SURFACE.azimuthDeg)]
  );
  const [tiltInputStrings, setTiltInputStrings] = useState<string[]>(
    saved?.hydrated.tiltInputStrings ?? [String(DEFAULT_SURFACE.tiltDeg)]
  );
  const [draftReady, setDraftReady] = useState(false);

  useLayoutEffect(() => {
    if (saved) return;
    const draft = readCalculateDraft();
    if (draft) {
      setFormData(draft.formData);
      setKwpInputStrings(draft.kwpInputStrings);
      setAzimuthInputStrings(draft.azimuthInputStrings);
      setTiltInputStrings(draft.tiltInputStrings);
    }
    setDraftReady(true);
  }, [saved]);

  const persistDraft = useCallback(() => {
    if (saved) return;
    writeCalculateDraft({
      formData,
      kwpInputStrings,
      azimuthInputStrings,
      tiltInputStrings,
    });
  }, [saved, formData, kwpInputStrings, azimuthInputStrings, tiltInputStrings]);

  useEffect(() => {
    if (saved || !draftReady) return;
    persistDraft();
  }, [saved, draftReady, persistDraft]);

  const openSavedGaps = (saved?.hydrated.missing ?? []).filter((item) =>
    savedInputGapIsOpen(formData, item.id)
  );
  const missingInputLabels = openSavedGaps.map((item) => item.label);
  const unrecordedGapIds = openSavedGaps.map((item) => item.id);

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

  useLayoutEffect(() => {
    if (step !== "calculating") return;
    if (!pendingScrollToRunRef.current) return;

    scrollPageToTop();
    mainPaneRef.current?.focus({ preventScroll: true });
    const assertTopFrame = requestAnimationFrame(() => {
      if (!pendingScrollToRunRef.current) return;
      pendingScrollToRunRef.current = false;
      scrollPageToTop();
    });
    return () => cancelAnimationFrame(assertTopFrame);
  }, [step]);

  useEffect(() => {
    if ((errors.length === 0 && !notice) || formLocked) return;

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
  }, [errors, notice, fieldErrors, formLocked]);

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
    setNotice(null);
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
    setRunSceneOpen(false);
    pendingScrollToRunRef.current = true;
    setRunPreview({
      ...formData,
      pvSurfaces: surfacesOrDefault(formData),
    });
    setStep("calculating");

    try {
      const calculationInput = buildHouseholdCalculationInput(formData);

      const response = await runHouseholdCalculationStream(
        calculationInput,
        (event) => {
          setCalculationProgress((prev) => applyCalculationProgress(prev, event));
        }
      );
      const completed = response.payload;

      const startedAt = calculationStartedAtRef.current ?? Date.now();
      const durationMs = Date.now() - startedAt;
      setCalculationDurationMs(durationMs);
      setElapsedSeconds(Math.floor(durationMs / 1000));
      setCalculationComplete(true);
      setCalculatedFingerprint(calculationInputFingerprint(formData));

      setCompletedCalculationId(response.calculationId);
      setCompletedAccessTier(response.accessTier);
      setVerifiedResult(completed.verifiedResult);
      setSpeicherGrenz(completed.speicherGrenz);
      setRobustness(completed.robustness);
      setWasserWasserRobustness(completed.wasserWasserRobustness);
      setDisplayAddress(completed.displayAddress);
      setHeatPumpCitation(
        completed.heatPump
          ? { methodologySourceId: completed.heatPump.methodologySourceId }
          : null
      );
      setEvResult(completed.ev);
      setPresentationOverride(null);
      setResultPresentation({
        surfaces: surfacesOrDefault(formData),
        annualConsumptionKwh: formData.annualConsumptionKwh,
        heatPumpEnabled: calculationInput.heatPumpEnabled,
        heatPumpConsumptionKwh: calculationInput.heatPumpConsumptionKWh,
        heatPumpTechnology: calculationInput.heatPumpTechnology,
        heatPumpDhwService: calculationInput.heatPumpDhwService,
        evEnabled: formData.evEnabled,
        backupReserveKwh: formData.backupReserveKwh,
        totalKwPConfigured: calculationInput.pvSystemKwP,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, CALCULATION_COMPLETE_PAUSE_MS)
      );
      setStep("results");
      if (saved?.id && response.calculationId) {
        router.replace(`/result/${response.calculationId}`);
      }
    } catch (err) {
      pendingScrollToRunRef.current = false;
      if (err instanceof CalculationNoticeError) {
        // Not an input mistake: own box, no "Bitte korrigieren Sie ..." heading.
        setNotice({
          kind: err.kind,
          message: err.message,
          code: err.code,
          freeAddress: err.freeAddress,
          addressLimit: err.addressLimit,
        });
        setErrors([]);
        setFieldErrors({});
      } else {
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
    setCalculatedFingerprint(null);
    setVerifiedResult(null);
    setSpeicherGrenz(null);
    setRobustness(null);
    setWasserWasserRobustness(null);
    setDisplayAddress(null);
    setHeatPumpCitation(null);
    setEvResult(null);
    setCompletedCalculationId(null);
    setCompletedAccessTier(null);
    setPresentationOverride(null);
    setResultPresentation(null);
    setRunPreview(null);
    setRunSceneOpen(false);
    pendingScrollToRunRef.current = false;
    setCalculationComplete(false);
    setCalculationDurationMs(null);
    calculationStartedAtRef.current = null;
    setElapsedSeconds(0);
    setErrors([]);
    setNotice(null);
    setFieldErrors({});
    setCalculationProgress(INITIAL_CALCULATION_PROGRESS);
    clearCalculateDraft();
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

  const runPreviewCard = <RunSystemPreview formData={runPreview ?? formData} />;

  const progress = (
    <CalculationProgressList
      progress={calculationProgress}
      elapsedSeconds={elapsedSeconds}
      complete={calculationComplete}
      includeHeatPumpProfile={includeHeatPumpProfile}
      includeEvProfile={includeEvProfile}
    />
  );

  const resultScene = systemSceneFromForm(runPreview ?? formData);

  const report =
    step === "results" && verifiedResult && resultPresentation ? (
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
          presentationOverride={presentationOverride}
          calculationDurationMs={calculationDurationMs}
          pdfCalculationId={completedCalculationId}
          accessKind={completedAccessTier}
          bodyClassName={
            editing
              ? isStale
                ? "pointer-events-none opacity-[0.72]"
                : "opacity-80"
              : undefined
          }
          bodyHidden={isStale}
          anlageOpen={runSceneOpen}
          anlageScene={
            <SystemScene
              heatPump={resultScene.heatPump}
              heatPumpKind={resultScene.heatPumpKind}
              ev={resultScene.ev}
              backupReserve={resultScene.backupReserve}
            />
          }
        />
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
        className={`sg-run-focus flex flex-col ${
          step === "results" ? "gap-0" : "gap-6"
        }`}
      >
        {step === "calculating" ? (
          <>
            {runPreviewCard}
            {progress}
          </>
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
              anlageOpen={runSceneOpen}
              onToggleAnlage={() => setRunSceneOpen((open) => !open)}
              chips={
                <SelectedSystemChips
                  formData={runPreview ?? formData}
                  showNote={false}
                  className="sg-completed-chips"
                />
              }
            />
            {report ? <ResultNavigation /> : null}
            {report}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="sg-calculate-page min-w-0 px-layout-gap pb-3 pt-5">
      <div className="mb-title-section-gap flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <h1 className="text-[1.875rem] font-bold leading-none tracking-[-0.035em] text-ink sm:text-[2.375rem] lg:text-[2.875rem]">
            Ihre Speicher-Analyse
          </h1>
          <p className="mt-1.5 text-[1.125rem] leading-[1.45] text-ink-secondary">
            Technische Analyse
          </p>
        </div>
        <CalculatePageStatus status={pageStatus} />
      </div>

      <SpeicherCalculateWorkspace
        pinMain={step === "input"}
        pinForm={step !== "input"}
        mainColumnHeading={
          step === "results"
            ? { number: "02", label: "Ergebnis" }
            : null
        }
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
            notice={notice}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
            locked={formLocked}
            submitLabel={
              calculatedFingerprint ? "Neu berechnen" : "Berechnung starten"
            }
            showSubmit={!formLocked}
            onSubmit={handleSubmit}
            fieldsScrollable={step !== "input"}
            missingInputLabels={missingInputLabels}
            unrecordedGapIds={unrecordedGapIds}
            onEditInputs={
              step === "results" && formLocked
                ? () => setEditing(true)
                : undefined
            }
            errorBoxRef={errorBoxRef}
            fieldInputRefs={fieldInputRefs}
            tariffsUrl={TARIFFS_URL}
            onBeforeLeave={persistDraft}
            onUsePinnedAddress={(address: PinnedAddressFields) => {
              setFormData((prev) => ({
                ...prev,
                street: address.street,
                houseNumber: address.houseNumber,
                postalCode: address.postalCode,
                city: address.city,
              }));
              setNotice(null);
              setErrors([]);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.street;
                delete next.houseNumber;
                delete next.postalCode;
                delete next.city;
                return next;
              });
            }}
          />
        }
        main={main}
      />
    </div>
  );
}
