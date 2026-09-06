import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getHubLoginUrlForSpeicherCalculate } from "@pv-auth/session";

import { getServerUser } from "@/lib/auth";

export const maxDuration = 300;

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  if (!user) {
    redirect(getHubLoginUrlForSpeicherCalculate());
  }
  return <>{children}</>;
}
