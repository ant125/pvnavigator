import {
  pinnedAddressIsRestorable,
  type PinnedAddressFields,
} from "./calculationNotice";

const primaryLink =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] sm:w-auto";

const secondaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[#0F172A] shadow-sm transition hover:bg-[#FAFBFC] sm:w-auto";

/**
 * Compact offer when the free address is already pinned to another address.
 * Not used for technical failures or an exhausted paid quota.
 */
export function FreeAddressLimitCard({
  address,
  tariffsUrl,
  onUsePinnedAddress,
  onBeforeLeave,
}: {
  address: PinnedAddressFields;
  tariffsUrl: string;
  onUsePinnedAddress?: (address: PinnedAddressFields) => void;
  onBeforeLeave?: () => void;
}) {
  const canRestore = pinnedAddressIsRestorable(address) && Boolean(onUsePinnedAddress);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="free-address-limit-card"
      className="mx-1 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0F172A]"
    >
      <p className="font-semibold leading-snug">Kostenlose Adresse bereits verwendet</p>
      <p className="mt-2 leading-snug text-[#334155]">
        Der kostenlose Zugang umfasst eine Adresse pro Konto. Nur eine neue Adresse würde einen weiteren Platz benötigen.
      </p>
      <p className="mt-2 font-semibold leading-snug">{address.label}</p>
      <p className="mt-2 leading-snug text-[#334155]">
        Diese Adresse können Sie mit unterschiedlichen Einstellungen erneut berechnen. Weitere Adressen sind mit STARTER, ABO oder PRO möglich.
      </p>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <a href={tariffsUrl} className={primaryLink} onClick={() => onBeforeLeave?.()}>
          Tarife ansehen
        </a>
        {canRestore ? (
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => onUsePinnedAddress?.(address)}
          >
            Kostenlose Adresse verwenden
          </button>
        ) : null}
      </div>
    </div>
  );
}
