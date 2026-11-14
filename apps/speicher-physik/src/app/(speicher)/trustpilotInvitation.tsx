"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { recordTrustpilotShown } from "@/app/actions/trustpilot";

type TrustpilotInvitationContextValue = {
  show: boolean;
  hide: () => void;
  recordShownOnce: () => void;
};

const TrustpilotInvitationContext = createContext<TrustpilotInvitationContextValue>({
  show: false,
  hide: () => {},
  recordShownOnce: () => {},
});

export function TrustpilotInvitationProvider({
  show,
  recordShown,
  children,
}: {
  show: boolean;
  recordShown: boolean;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(show);
  const shownRequested = useRef(false);

  useEffect(() => {
    if (!show) setVisible(false);
  }, [show]);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const recordShownOnce = useCallback(() => {
    if (!recordShown || shownRequested.current) return;
    shownRequested.current = true;
    void recordTrustpilotShown();
  }, [recordShown]);

  const value = useMemo(
    () => ({ show: visible, hide, recordShownOnce }),
    [visible, hide, recordShownOnce],
  );

  return (
    <TrustpilotInvitationContext.Provider value={value}>
      {children}
    </TrustpilotInvitationContext.Provider>
  );
}

export function useTrustpilotInvitation(): TrustpilotInvitationContextValue {
  return useContext(TrustpilotInvitationContext);
}
