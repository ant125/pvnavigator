import type Stripe from "stripe";

/**
 * One-shot live preparation for the net prices. It creates monthly prices on
 * the existing products and turns on German Stripe Tax. It does not update
 * subscriptions, subscription items, schedules, or invoices already issued.
 */

export const SAAS_TAX_CODE = "txcd_10103000";

export const BUSINESS_HEAD_OFFICE = {
  line1: "Branderstraße 44",
  city: "Augsburg",
  postal_code: "86154",
  country: "DE",
} as const;

const KLEINUNTERNEHMER_FOOTER = "§ 19";

export const LIVE_VAT_PLANS = [
  {
    label: "STARTER",
    productName: "PVNAVIGATOR_ STARTER",
    envVar: "STRIPE_PRICE_STARTER_ID",
    legacyCents: 900,
    netCents: 800,
    lookupKey: "pvnavigator_starter_monthly_net_800",
  },
  {
    label: "ABO",
    productName: "PVNAVIGATOR_ ABO",
    envVar: "STRIPE_PRICE_ID",
    legacyCents: 2900,
    netCents: 2500,
    lookupKey: "pvnavigator_abo_monthly_net_2500",
  },
  {
    label: "PRO",
    productName: "PVNAVIGATOR_ PRO",
    envVar: "STRIPE_PRICE_PRO_ID",
    legacyCents: 5900,
    netCents: 5000,
    lookupKey: "pvnavigator_pro_monthly_net_5000",
  },
] as const;

export type LiveVatPlan = (typeof LIVE_VAT_PLANS)[number];

type PriceShape = {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  tax_behavior: string | null;
  livemode: boolean;
  recurring: { interval: string; interval_count: number } | null;
};

export function isExclusiveMonthlyNet(price: PriceShape, netCents: number): boolean {
  return (
    price.active &&
    price.livemode &&
    price.currency === "eur" &&
    price.unit_amount === netCents &&
    price.tax_behavior === "exclusive" &&
    price.recurring?.interval === "month" &&
    (price.recurring.interval_count ?? 1) === 1
  );
}

export function footerCarriesKleinunternehmer(footer: string | null | undefined): boolean {
  return (footer ?? "").includes(KLEINUNTERNEHMER_FOOTER) || (footer ?? "").includes("Kleinunternehmer");
}

export type LiveVatReport = {
  livemode: true;
  prices: Array<{ label: string; legacyPriceId: string; netPriceId: string; created: boolean }>;
  subscriptionsUntouched: Array<{ priceId: string; status: string; count: number; automaticTax: number }>;
  tax: {
    status: string;
    headOfficeCountry: string | null;
    behavior: string | null;
    taxCode: string | null;
    registration: { country: string; status: string; type: string | null } | null;
    createdRegistration: boolean;
  };
  calculations: Array<{ country: string; net: number; tax: number | null; total: number | null; error: string | null }>;
  footersCleared: { account: boolean; customers: number };
};

function stripeMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.slice(0, 300);
  }
  return "error";
}

async function listAllSubscriptions(stripe: Stripe): Promise<Stripe.Subscription[]> {
  const rows: Stripe.Subscription[] = [];
  for (const status of ["active", "trialing", "past_due", "unpaid", "paused"] as const) {
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({ status, limit: 100, starting_after: startingAfter });
      rows.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data.at(-1)?.id;
    }
  }
  return rows;
}

function subscriptionSummary(subscriptions: Stripe.Subscription[]): LiveVatReport["subscriptionsUntouched"] {
  const counts = new Map<string, { priceId: string; status: string; count: number; automaticTax: number }>();
  for (const subscription of subscriptions) {
    const price = subscription.items.data[0]?.price;
    const priceId = price?.id ?? "none";
    const key = `${subscription.status}:${priceId}`;
    const row = counts.get(key) ?? { priceId, status: subscription.status, count: 0, automaticTax: 0 };
    row.count += 1;
    if (subscription.automatic_tax?.enabled) row.automaticTax += 1;
    counts.set(key, row);
  }
  return [...counts.values()];
}

/**
 * Prepares live German VAT and the three net prices.
 * Throws before any write when the account is not the expected live catalog.
 */
export async function prepareLiveVat(stripe: Stripe): Promise<LiveVatReport> {
  const before = await listAllSubscriptions(stripe);
  const products = await stripe.products.list({ limit: 100, active: true });
  const resolved: Array<{
    plan: LiveVatPlan;
    product: Stripe.Product;
    legacy: Stripe.Price;
    found: Stripe.Price | null;
  }> = [];

  for (const plan of LIVE_VAT_PLANS) {
    const named = products.data.filter((product) => product.name === plan.productName);
    if (named.length !== 1) {
      throw new Error(`Expected one active product ${plan.productName}, found ${named.length}`);
    }
    const product = named[0];
    const configuredId = process.env[plan.envVar]?.trim() ?? "";
    if (!configuredId.startsWith("price_")) throw new Error(`Missing ${plan.envVar}`);
    const legacy = await stripe.prices.retrieve(configuredId);
    const legacyProductId = typeof legacy.product === "string" ? legacy.product : legacy.product?.id;
    if (
      !legacy.livemode ||
      !legacy.active ||
      legacy.unit_amount !== plan.legacyCents ||
      legacy.currency !== "eur" ||
      legacy.recurring?.interval !== "month" ||
      legacyProductId !== product.id
    ) {
      throw new Error(`Configured ${plan.label} price is not the current live monthly price`);
    }
    const existing = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const found =
      existing.data.find((price) =>
        isExclusiveMonthlyNet(
          {
            id: price.id,
            active: price.active,
            currency: price.currency,
            unit_amount: price.unit_amount,
            tax_behavior: price.tax_behavior,
            livemode: price.livemode,
            recurring: price.recurring
              ? { interval: price.recurring.interval, interval_count: price.recurring.interval_count }
              : null,
          },
          plan.netCents,
        ),
      ) ?? null;
    resolved.push({ plan, product, legacy, found });
  }

  const prices: LiveVatReport["prices"] = [];
  for (const row of resolved) {
    const net = row.found
      ? row.found
      : await stripe.prices.create(
          {
            product: row.product.id,
            currency: "eur",
            unit_amount: row.plan.netCents,
            tax_behavior: "exclusive",
            recurring: { interval: "month", interval_count: 1 },
            lookup_key: row.plan.lookupKey,
            nickname: `${row.plan.label} monatlich netto`,
            metadata: { plan_label: row.plan.label, tax_behavior: "exclusive" },
          },
          { idempotencyKey: row.plan.lookupKey },
        );
    if (row.product.tax_code !== SAAS_TAX_CODE) {
      await stripe.products.update(row.product.id, { tax_code: SAAS_TAX_CODE });
    }
    prices.push({
      label: row.plan.label,
      legacyPriceId: row.legacy.id,
      netPriceId: net.id,
      created: !row.found,
    });
  }

  const settings = await stripe.tax.settings.retrieve();
  if (!settings.livemode) throw new Error("Tax settings are not in live mode");
  const headOffice = settings.head_office?.address;
  const headOfficeMatches =
    headOffice?.country === "DE" &&
    headOffice.postal_code === BUSINESS_HEAD_OFFICE.postal_code &&
    headOffice.city === BUSINESS_HEAD_OFFICE.city &&
    headOffice.line1 === BUSINESS_HEAD_OFFICE.line1;
  const updatedSettings = await stripe.tax.settings.update({
    ...(headOfficeMatches ? {} : { head_office: { address: { ...BUSINESS_HEAD_OFFICE } } }),
    defaults: { tax_behavior: "exclusive", tax_code: SAAS_TAX_CODE },
  });

  const registrations = await stripe.tax.registrations.list({ limit: 100 });
  let createdRegistration = false;
  let registration =
    registrations.data.find((item) => item.country === "DE" && item.status === "active") ?? null;
  if (!registration) {
    registration = await stripe.tax.registrations.create({
      country: "DE",
      active_from: "now",
      country_options: {
        de: { type: "standard", standard: { place_of_supply_scheme: "small_seller" } },
      },
    });
    createdRegistration = true;
  }

  const calculations: LiveVatReport["calculations"] = [];
  for (const country of ["DE", "FR"] as const) {
    try {
      const calculation = await stripe.tax.calculations.create({
        currency: "eur",
        customer_details: {
          address: {
            country,
            postal_code: country === "DE" ? "86154" : "75001",
            city: country === "DE" ? "Augsburg" : "Paris",
            line1: country === "DE" ? BUSINESS_HEAD_OFFICE.line1 : "1 Rue de Rivoli",
          },
          address_source: "billing",
        },
        line_items: [
          {
            amount: 2500,
            reference: "abo",
            tax_behavior: "exclusive",
            tax_code: SAAS_TAX_CODE,
          },
        ],
      });
      calculations.push({
        country,
        net: 2500,
        tax: calculation.tax_amount_exclusive,
        total: calculation.amount_total,
        error: null,
      });
    } catch (error) {
      calculations.push({ country, net: 2500, tax: null, total: null, error: stripeMessage(error) });
    }
  }

  const account = await stripe.accounts.retrieve(null);
  const accountFooter = (account.settings?.invoices as { footer?: string | null } | undefined)?.footer;
  let accountFooterCleared = false;
  if (footerCarriesKleinunternehmer(accountFooter)) {
    await stripe.accounts.update(account.id, {
      settings: {
        invoices: { footer: "" } as unknown as Stripe.AccountUpdateParams.Settings.Invoices,
      },
    });
    accountFooterCleared = true;
  }

  let customers = 0;
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.customers.list({ limit: 100, starting_after: startingAfter });
    for (const customer of page.data) {
      if (!footerCarriesKleinunternehmer(customer.invoice_settings?.footer)) continue;
      await stripe.customers.update(customer.id, { invoice_settings: { footer: "" } });
      customers += 1;
    }
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1)?.id;
  }

  const after = await listAllSubscriptions(stripe);
  if (JSON.stringify(subscriptionSummary(before)) !== JSON.stringify(subscriptionSummary(after))) {
    throw new Error("Subscription set changed while preparing prices");
  }

  return {
    livemode: true,
    prices,
    subscriptionsUntouched: subscriptionSummary(after),
    tax: {
      status: updatedSettings.status,
      headOfficeCountry: updatedSettings.head_office?.address.country ?? null,
      behavior: updatedSettings.defaults.tax_behavior,
      taxCode: updatedSettings.defaults.tax_code,
      registration: registration
        ? {
            country: registration.country,
            status: registration.status,
            type: registration.country_options.de?.type ?? null,
          }
        : null,
      createdRegistration,
    },
    calculations,
    footersCleared: { account: accountFooterCleared, customers },
  };
}
