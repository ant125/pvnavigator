import { PAID_PLANS, VAT_EXEMPTION_LABEL, formatDateDe, type PaidPlanId } from "@pv-access/core";

import {
  billingPortalButtonLabel,
  grantedPeriodPaymentLine,
  openSubscriptionCopy,
  type TariffViewer,
} from "@/lib/accessSummary";

import { BillingPostButton } from "./BillingPostButton";
import { ImmediateProUpgrade } from "./ImmediateProUpgrade";
import { ResumeCheckout } from "./ResumeCheckout";
import { immediateUpgradeOffer } from "./upgradeDialogCopy";

const card =
  "flex w-full max-w-[22.5rem] flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] min-[740px]:max-w-none min-[1200px]:row-span-5 min-[1200px]:grid min-[1200px]:grid-rows-subgrid";

const currentMark =
  "inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-semibold text-[#64748B]";

const primaryLink =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03]";

const NOTES = [
  {
    title: "Adressen statt Berichte",
    body: "Jede Adresse zählt pro Abrechnungszeitraum nur einmal – auch bei mehreren Varianten und über verschiedene Produkte hinweg.",
  },
  {
    title: "Ihr Abrechnungsmonat",
    body: "Die 10, 50 bzw. 200 Adressen gelten für Ihren monatlichen bezahlten Zeitraum, nicht für den Kalendermonat. Mit dem nächsten bezahlten Zeitraum steht das Kontingent erneut zur Verfügung.",
  },
  {
    title: "Kündigung",
    body: "Sie können zum Ende des bezahlten Zeitraums kündigen. Bis dahin bleibt Ihr Zugang bestehen.",
  },
  {
    title: "Gespeicherte Berichte",
    body: "Ihre Berichte bleiben nach Ablauf des Abos verfügbar. Ein späteres Upgrade entfernt die Privatkennzeichnung bestehender kostenloser Berichte nicht.",
  },
] as const;

const alignWithCards = "mx-auto w-full max-w-[22.5rem] min-[740px]:mx-0 min-[740px]:max-w-none";

const FREE_FEATURES = [
  "SPEICHERGRENZE inklusive",
  "Beliebig viele Varianten für Ihre Adresse",
  "PDF mit Hinweis zur privaten Nutzung",
] as const;

const PAID_FEATURES = [
  "SPEICHERGRENZE inklusive",
  "Beliebig viele Varianten je Adresse",
  "PDF ohne Privatnutzungskennzeichnung",
  "Gewerbliche Nutzung inklusive",
] as const;

function Feature({ children }: { children: string }) {
  return <li className="text-sm leading-snug text-[#334155]">{children}</li>;
}

function Price({ amount, period }: { amount: string; period: boolean }) {
  return (
    <div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A]">
        {amount}
        {period ? <span className="ml-1 text-base font-medium text-[#64748B]">/ Monat</span> : null}
      </p>
      <p
        className={
          period
            ? "mt-1 text-xs leading-snug text-[#64748B]"
            : "invisible mt-0 max-h-0 overflow-hidden text-xs leading-snug text-[#64748B] min-[1100px]:mt-1 min-[1100px]:max-h-none"
        }
        aria-hidden={period ? undefined : true}
      >
        {VAT_EXEMPTION_LABEL}
      </p>
    </div>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-4 space-y-1.5">
      {items.map((item) => (
        <Feature key={item}>{item}</Feature>
      ))}
    </ul>
  );
}

function loginHref(plan: PaidPlanId): string {
  return `/anmelden?next=${encodeURIComponent(`/tarife?auswahl=${plan}`)}`;
}

export function TariffGrid({
  viewer,
  resumePlan,
  upgradeLocked = false,
}: {
  viewer: TariffViewer;
  resumePlan: PaidPlanId | null;
  /** Server already has an upgrade checkout in progress. */
  upgradeLocked?: boolean;
}) {
  const paid = viewer.kind === "current_paid" ? viewer : null;
  const showPortal = viewer.kind === "payment_open" && viewer.canManage;
  const openCopy = viewer.kind === "payment_open" ? openSubscriptionCopy(viewer.billingStatus) : null;
  const periodProblem = paid?.paymentProblem
    ? grantedPeriodPaymentLine(paid.billingStatus ?? null, paid.periodEnd)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="grid grid-cols-1 justify-items-center gap-5 min-[740px]:grid-cols-2 min-[740px]:justify-items-stretch min-[1200px]:grid-cols-4 min-[1200px]:gap-x-5 min-[1200px]:gap-y-0">
        <FreeCard viewer={viewer} />
        <PaidCard plan="starter" viewer={viewer} resumePlan={resumePlan} upgradeLocked={upgradeLocked} />
        <PaidCard plan="abo" viewer={viewer} resumePlan={resumePlan} upgradeLocked={upgradeLocked} />
        <PaidCard plan="pro" viewer={viewer} resumePlan={resumePlan} upgradeLocked={upgradeLocked} />
      </div>

      <p className={`${alignWithCards} mt-6 text-sm leading-relaxed text-[#334155]`}>
        STARTER, ABO und PRO enthalten nach Veröffentlichung auch RENDITEGUIDE.
      </p>

      {paid?.scheduledPlan && paid.scheduledAt ? (
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#334155]">
          Wechsel zu {PAID_PLANS[paid.scheduledPlan].label} am {formatDateDe(paid.scheduledAt)}. Der laufende
          Zeitraum und sein Adresskontingent bleiben unverändert.
        </p>
      ) : null}
      {paid?.subscriptionCanceled ? (
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#334155]">
          Abonnement gekündigt. Zugang bis {formatDateDe(paid.periodEnd)}.
        </p>
      ) : paid?.cancelAtPeriodEnd ? (
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#334155]">
          Gekündigt zum {formatDateDe(paid.periodEnd)}. Der bezahlte Zugang bleibt bis dahin erhalten.
        </p>
      ) : null}
      {periodProblem ? (
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#334155]">
          {periodProblem}
        </p>
      ) : null}
      {openCopy ? (
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#334155]">
          {openCopy.description}
        </p>
      ) : null}

      {showPortal && viewer.kind === "payment_open" ? (
        <div className="mx-auto mt-4 w-full max-w-[22.5rem]">
          <BillingPostButton
            action="/api/billing/portal"
            label={billingPortalButtonLabel(false, viewer.billingStatus)}
            pendingLabel="Wird geöffnet…"
            tone="ghost"
          />
        </div>
      ) : null}

      <section className={`${alignWithCards} mt-8`} aria-labelledby="tariff-notes-heading">
        <h2 id="tariff-notes-heading" className="text-sm font-semibold text-[#0F172A]">
          Gut zu wissen
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-4 min-[740px]:grid-cols-2 min-[740px]:gap-x-8 min-[740px]:gap-y-5">
          {NOTES.map((note) => (
            <li key={note.title}>
              <p className="text-sm font-semibold text-[#0F172A]">{note.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#64748B]">{note.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FreeCard({ viewer }: { viewer: TariffViewer }) {
  return (
    <article className={card} data-testid="tariff-free">
      <h2 className="text-lg font-semibold text-[#0F172A]">Kostenlos</h2>
      <Price amount="0 €" period={false} />
      <p className="mt-3 text-base font-semibold leading-snug text-[#0F172A]">1 feste Adresse</p>
      <FeatureList items={FREE_FEATURES} />
      <div className="mt-auto pt-5">
        {viewer.kind === "guest" ? (
          <a href="/konto-erstellen?next=%2Ftarife" className={primaryLink}>
            Kostenlos registrieren
          </a>
        ) : viewer.kind === "current_free" ? (
          <span className={currentMark} aria-current="true">
            Aktueller Tarif
          </span>
        ) : viewer.kind === "payment_open" ? (
          <span className="text-sm text-[#64748B]">Derzeit kein bezahlter Zugang.</span>
        ) : (
          <span className="text-sm text-[#64748B]">Im gewählten Tarif enthalten.</span>
        )}
      </div>
    </article>
  );
}

function PaidCard({
  plan,
  viewer,
  resumePlan,
  upgradeLocked,
}: {
  plan: PaidPlanId;
  viewer: TariffViewer;
  resumePlan: PaidPlanId | null;
  upgradeLocked: boolean;
}) {
  const spec = PAID_PLANS[plan];
  const paid = viewer.kind === "current_paid" ? viewer : null;
  const isCurrent = paid?.plan === plan;
  const isScheduled = paid?.scheduledPlan === plan;
  const formId = `tariff-checkout-${plan}`;
  const addressLine = `${spec.addressLimit} Adressen pro Monat`;

  return (
    <article className={card} data-testid={`tariff-${plan}`}>
      <h2 className="text-lg font-semibold text-[#0F172A]">{spec.label}</h2>
      <Price amount={spec.priceLabel} period />
      <p className="mt-3 text-base font-semibold leading-snug text-[#0F172A]">{addressLine}</p>
      <FeatureList items={PAID_FEATURES} />
      <div className="mt-auto pt-5">
        <PaidAction
          plan={plan}
          label={spec.label}
          viewer={viewer}
          isCurrent={isCurrent}
          isScheduled={isScheduled}
          formId={formId}
          resume={resumePlan === plan && viewer.kind === "current_free"}
          upgradeLocked={upgradeLocked}
        />
      </div>
    </article>
  );
}

function PaidAction({
  plan,
  label,
  viewer,
  isCurrent,
  isScheduled,
  formId,
  resume,
  upgradeLocked,
}: {
  plan: PaidPlanId;
  label: string;
  viewer: TariffViewer;
  isCurrent: boolean;
  isScheduled: boolean;
  formId: string;
  resume: boolean;
  upgradeLocked: boolean;
}) {
  if (viewer.kind === "guest") {
    return (
      <a href={loginHref(plan)} className={primaryLink}>
        {label} abschließen
      </a>
    );
  }

  if (viewer.kind === "payment_open") {
    const title = openSubscriptionCopy(viewer.billingStatus)?.title ?? "Zahlung offen";
    return <span className="text-sm text-[#64748B]">{title}.</span>;
  }

  if (viewer.kind === "current_paid") {
    if (isCurrent) {
      return (
        <div className="space-y-2">
          <span className={currentMark} aria-current="true">
            Aktueller Tarif
          </span>
          {viewer.canManage ? (
            <BillingPostButton
              action="/api/billing/portal"
              label={billingPortalButtonLabel(true, null)}
              pendingLabel="Wird geöffnet…"
              tone="ghost"
            />
          ) : null}
          {viewer.scheduledPlan ? (
            <BillingPostButton
              action="/api/billing/change-plan"
              label="Wechsel zurücknehmen"
              pendingLabel="Wird zurückgenommen…"
              tone="ghost"
              fields={{ plan }}
            />
          ) : null}
        </div>
      );
    }
    const upgrade = immediateUpgradeOffer(viewer);
    if (upgrade && (plan === "abo" || plan === "pro") && upgrade.targets.includes(plan)) {
      return upgrade.current === "starter" ? (
        <ImmediateProUpgrade currentPlan="starter" target={plan} locked={upgradeLocked} />
      ) : (
        <ImmediateProUpgrade locked={upgradeLocked} />
      );
    }
    if (isScheduled && viewer.scheduledAt) {
      return (
        <p className="text-sm font-semibold leading-relaxed text-[#0F172A]">
          Geplant ab {formatDateDe(viewer.scheduledAt)}
        </p>
      );
    }
    if (viewer.plan === "pro" && plan === "abo") {
      return <span className="text-sm text-[#64748B]">Sie nutzen bereits den PRO-Tarif.</span>;
    }
    return <span className="text-sm text-[#64748B]">Ihr aktueller Tarif bleibt bestehen.</span>;
  }

  return (
    <>
      {resume ? <ResumeCheckout formId={formId} /> : null}
      <BillingPostButton
        formId={formId}
        action="/api/billing/checkout"
        label={`${label} abschließen`}
        pendingLabel="Weiter zur Zahlung…"
        fields={{ plan }}
      />
    </>
  );
}
