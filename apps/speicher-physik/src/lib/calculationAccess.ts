import {
  accessDeniedMessage,
  buildAddressKey,
  formatAddressLabel,
  parseAccessDecision,
  parseAccessDeniedError,
  type AccessDecision,
  type AccessReason,
  type AccessTier,
} from "@pv-access/core";

import type { PinnedAddressFields } from "@/app/(speicher)/calculate/calculationNotice";
import type { HouseholdCalculationInput } from "@/app/(speicher)/calculate/runHouseholdCalculation";

/**
 * Minimal Supabase surface used here, so the decision helpers can be
 * exercised with a stub client.
 */
export type AccessRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type FreeAddressLookup = {
  from: (table: string) => {
    select: (columns: string) => {
      maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
};

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The pinned address and the original entered fields, from the account's
 * own rows. Used only to explain a free-address mismatch.
 */
export async function loadPinnedFreeAddress(
  supabase: FreeAddressLookup,
): Promise<PinnedAddressFields | null> {
  const freeResult = await supabase
    .from("free_addresses")
    .select("address_label, calculation_id")
    .maybeSingle();
  if (freeResult.error || !freeResult.data || typeof freeResult.data !== "object") return null;
  const free = freeResult.data as { address_label?: unknown; calculation_id?: unknown };
  const label = textField(free.address_label);
  let street = "";
  let houseNumber = "";
  let postalCode = "";
  let city = "";
  if (typeof free.calculation_id === "string" && free.calculation_id) {
    const calcResult = await supabase
      .from("calculations")
      .select("input")
      .eq("id", free.calculation_id)
      .maybeSingle();
    const input =
      calcResult.data && typeof calcResult.data === "object"
        ? (calcResult.data as { input?: unknown }).input
        : null;
    if (input && typeof input === "object" && !Array.isArray(input)) {
      const fields = input as Record<string, unknown>;
      street = textField(fields.street);
      houseNumber = textField(fields.houseNumber);
      postalCode = textField(fields.postalCode);
      city = textField(fields.city);
    }
  }
  if (!label) return null;
  return { label, street, houseNumber, postalCode, city };
}

export type CalculationAddress = {
  key: string;
  label: string;
};

/** Address identity for the access rules, from the entered fields only. */
export function calculationAddress(input: HouseholdCalculationInput): CalculationAddress {
  const fields = {
    street: input.street,
    houseNumber: input.houseNumber,
    postalCode: input.postalCode,
    city: input.city,
  };
  return { key: buildAddressKey(fields), label: formatAddressLabel(fields) };
}

export type AccessCheckOutcome =
  | { status: "allowed"; decision: AccessDecision; tier: AccessTier }
  | { status: "denied"; decision: AccessDecision; message: string }
  | { status: "unavailable"; message: string };

export const ACCESS_UNAVAILABLE_MESSAGE =
  "Die Zugangsprüfung ist derzeit nicht möglich. Bitte versuchen Sie es in einigen Minuten erneut.";

/**
 * Server-side pre-check before the physics run. Read only: never pins an
 * address and never counts a subscription address.
 */
export async function checkCalculationAccess(
  supabase: AccessRpcClient,
  address: CalculationAddress,
): Promise<AccessCheckOutcome> {
  if (!address.key) {
    const decision: AccessDecision = {
      allowed: false,
      tier: null,
      reason: "invalid_address",
      subscription: null,
      freeAddressLabel: null,
    };
    return { status: "denied", decision, message: accessDeniedMessage(decision) };
  }

  const { data, error } = await supabase.rpc("check_calculation_access", {
    p_address_key: address.key,
  });
  if (error) {
    console.error("check_calculation_access failed", error);
    return { status: "unavailable", message: ACCESS_UNAVAILABLE_MESSAGE };
  }
  const decision = parseAccessDecision(data);
  if (!decision) {
    console.error("check_calculation_access returned an unexpected shape", data);
    return { status: "unavailable", message: ACCESS_UNAVAILABLE_MESSAGE };
  }
  if (!decision.allowed || !decision.tier) {
    return { status: "denied", decision, message: accessDeniedMessage(decision) };
  }
  return { status: "allowed", decision, tier: decision.tier };
}

export type RecordOutcome =
  | { status: "recorded"; calculationId: string; tier: AccessTier }
  | { status: "denied"; reason: AccessReason; message: string; addressLimit: number | null }
  | { status: "failed" };

/**
 * Atomic record of a successful calculation through the database function
 * (re-check under lock → insert with tier → pin / count). A refusal here is
 * a genuine access decision (e.g. a parallel request pinned another address
 * first). A technical failure ("failed") means the access accounting did not
 * happen; the API withholds the result in that case so an outage of the
 * record step cannot be used to run unlimited addresses.
 */
export async function recordCompletedCalculation(
  supabase: AccessRpcClient,
  args: { address: CalculationAddress; row: Record<string, unknown> },
): Promise<RecordOutcome> {
  const { data, error } = await supabase.rpc("record_completed_calculation", {
    p_address_key: args.address.key,
    p_address_label: args.address.label,
    p_calculation: args.row,
  });
  if (error) {
    const reason = parseAccessDeniedError(error.message);
    if (reason) {
      // Best effort: fetch the full decision so the explanation can name the
      // pinned address. The refusal itself stands regardless.
      const recheck = await checkCalculationAccess(supabase, args.address);
      const message =
        recheck.status === "denied"
          ? recheck.message
          : accessDeniedMessage({ reason, freeAddressLabel: null, subscription: null });
      const addressLimit =
        recheck.status === "denied" ? recheck.decision.subscription?.addressLimit ?? null : null;
      return { status: "denied", reason, message, addressLimit };
    }
    console.error("record_completed_calculation failed", error);
    return { status: "failed" };
  }
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as { calculation_id?: unknown }).calculation_id !== "string"
  ) {
    console.error("record_completed_calculation returned an unexpected shape", data);
    return { status: "failed" };
  }
  const tierValue = (data as { access_tier?: unknown }).access_tier;
  const tier: AccessTier = tierValue === "paid" ? "paid" : "free";
  return {
    status: "recorded",
    calculationId: (data as { calculation_id: string }).calculation_id,
    tier,
  };
}
