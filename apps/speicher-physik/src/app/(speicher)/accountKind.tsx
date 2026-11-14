"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StoredAccountKind = "privat" | "unternehmen" | null;

const AccountKindContext = createContext<StoredAccountKind>(null);

export function AccountKindProvider({
  kind,
  children,
}: {
  kind: StoredAccountKind;
  children: ReactNode;
}) {
  return <AccountKindContext.Provider value={kind}>{children}</AccountKindContext.Provider>;
}

export function useStoredAccountKind(): StoredAccountKind {
  return useContext(AccountKindContext);
}
