import { paidQuotaNotice } from "./addressQuotaCopy";

const primaryLink =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] sm:w-auto";

/**
 * Compact notice when a paid tariff has used every distinct address.
 * The link uses the hub tariff URL passed in by the page.
 */
export function AddressQuotaCard({
  addressLimit,
  tariffsUrl,
  onBeforeLeave,
}: {
  addressLimit: number | null;
  tariffsUrl: string;
  onBeforeLeave?: () => void;
}) {
  const copy = paidQuotaNotice(addressLimit);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="address-quota-card"
      className="mx-1 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0F172A]"
    >
      <p className="font-semibold leading-snug">{copy.title}</p>
      <div className="mt-2 space-y-2 leading-snug text-[#334155]">
        {copy.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="mt-2.5">
        <a href={tariffsUrl} className={primaryLink} onClick={() => onBeforeLeave?.()}>
          Tarife und Upgrades ansehen
        </a>
      </div>
    </div>
  );
}
