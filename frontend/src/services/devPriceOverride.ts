import { DEV_PRICE_STOREFRONT } from "@env";
import { REVENUECAT_PRODUCTS } from "../config/revenueCat";

/**
 * Worst-case storefront price strings, for previewing paywall layout without
 * switching App Store sandbox accounts.
 *
 * StoreKit already hands back correctly localized `priceString` values, so the
 * app never formats currency itself — but that means the only way to see a long
 * one is to own an account in that storefront. These fixtures stand in for that.
 * They are transcriptions of real Apple price tiers, not computed conversions.
 *
 * Note how many render an ISO code rather than a symbol (`AED`, `COP`). The
 * bundle declares no `CFBundleLocalizations`, so iOS formats in English
 * conventions, and English has no unambiguous symbol for those currencies. The
 * code form is longer than the symbol form, which is what makes it the case
 * worth designing against.
 */
type DevStorefrontPrices = {
  weekly: string;
  yearly: string;
  yearlyPerMonth: string;
  lifetime: string;
};

const DEV_STOREFRONTS: Record<string, DevStorefrontPrices> = {
  // Indonesia — the longest string in common circulation.
  id: {
    weekly: "Rp 79.000",
    yearly: "Rp 1.499.000",
    yearlyPerMonth: "Rp 124.917",
    lifetime: "Rp 4.999.000",
  },
  // Colombia — ISO code, dot grouping, comma decimals, six significant digits.
  co: {
    weekly: "COP 14.900,00",
    yearly: "COP 249.900,00",
    yearlyPerMonth: "COP 20.825,00",
    lifetime: "COP 899.900,00",
  },
  // India — the case that prompted this work.
  in: {
    weekly: "₹399.00",
    yearly: "₹5,724.25",
    yearlyPerMonth: "₹477.02",
    lifetime: "₹14,999.00",
  },
  // UAE — ISO code rather than a symbol under English formatting.
  ae: {
    weekly: "AED 18.99",
    yearly: "AED 220.00",
    yearlyPerMonth: "AED 18.33",
    lifetime: "AED 799.00",
  },
  // Japan — short, zero-decimal. Guards against over-correcting for length.
  jp: {
    weekly: "¥700",
    yearly: "¥9,800",
    yearlyPerMonth: "¥816",
    lifetime: "¥29,800",
  },
};

const getActiveStorefront = (): DevStorefrontPrices | null => {
  if (!__DEV__) {
    return null;
  }

  const key = DEV_PRICE_STOREFRONT?.trim().toLowerCase();

  if (!key) {
    return null;
  }

  return DEV_STOREFRONTS[key] || null;
};

const getProductField = (
  productIdentifier: string | undefined
): keyof DevStorefrontPrices | null => {
  switch (productIdentifier) {
    case REVENUECAT_PRODUCTS.WEEKLY:
      return "weekly";
    case REVENUECAT_PRODUCTS.YEARLY:
    case REVENUECAT_PRODUCTS.YEARLY_DISCOUNT:
      return "yearly";
    case REVENUECAT_PRODUCTS.LIFETIME:
      return "lifetime";
    default:
      return null;
  }
};

/**
 * Returns the override for a product's display price, or `null` to use the real
 * StoreKit value. Always `null` in release builds.
 */
export const getDevPriceOverride = (productIdentifier: string | undefined) => {
  const storefront = getActiveStorefront();

  if (!storefront) {
    return null;
  }

  const field = getProductField(productIdentifier);

  return field ? storefront[field] : null;
};

/**
 * Same, for the yearly plan's per-month subtitle. Only the annual products carry
 * a meaningful per-month value, so everything else falls through to the store.
 */
export const getDevPricePerMonthOverride = (
  productIdentifier: string | undefined
) => {
  const storefront = getActiveStorefront();

  if (!storefront) {
    return null;
  }

  return getProductField(productIdentifier) === "yearly"
    ? storefront.yearlyPerMonth
    : null;
};

export const DEV_PRICE_STOREFRONT_KEYS = Object.keys(DEV_STOREFRONTS);
