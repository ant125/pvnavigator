"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

export type CalculateHeaderStatus =
  | "input"
  | "calculating"
  | "complete"
  | "editing"
  | "stale";

type HeaderCtaContextValue = {
  reportActive: boolean;
  setReportActive: (active: boolean) => void;
  resetRef: MutableRefObject<(() => void) | null>;
  calculateStatus: CalculateHeaderStatus | null;
  setCalculateStatus: (status: CalculateHeaderStatus | null) => void;
};

const HeaderCtaContext = createContext<HeaderCtaContextValue | null>(null);

/** Lets the calculator report drive the header CTA without changing routes. */
export function useReportHeaderCta(reset: () => void, isReport: boolean) {
  const ctx = useContext(HeaderCtaContext);
  const setReportActive = ctx?.setReportActive;
  const resetRef = ctx?.resetRef;

  useEffect(() => {
    if (!setReportActive || !resetRef) return;
    setReportActive(isReport);
    resetRef.current = isReport ? reset : null;
    return () => {
      setReportActive(false);
      resetRef.current = null;
    };
  }, [setReportActive, resetRef, isReport, reset]);
}

export function useCalculateHeaderStatus(status: CalculateHeaderStatus | null) {
  const ctx = useContext(HeaderCtaContext);
  const setCalculateStatus = ctx?.setCalculateStatus;

  useEffect(() => {
    if (!setCalculateStatus) return;
    setCalculateStatus(status);
    return () => {
      setCalculateStatus(null);
    };
  }, [setCalculateStatus, status]);
}

export function HeaderCtaProvider({ children }: { children: ReactNode }) {
  const [reportActive, setReportActive] = useState(false);
  const [calculateStatus, setCalculateStatus] =
    useState<CalculateHeaderStatus | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  return (
    <HeaderCtaContext.Provider
      value={{
        reportActive,
        setReportActive,
        resetRef,
        calculateStatus,
        setCalculateStatus,
      }}
    >
      {children}
    </HeaderCtaContext.Provider>
  );
}

export function useHeaderCtaState() {
  const ctx = useContext(HeaderCtaContext);
  return {
    reportActive: ctx?.reportActive ?? false,
    resetRef: ctx?.resetRef,
    calculateStatus: ctx?.calculateStatus ?? null,
  };
}
