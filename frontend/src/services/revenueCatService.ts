import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { env } from "../config/env";
import type { PaywallOffering } from "./paywallService";

type RevenueCatPlanKey =
  | "annual"
  | "weekly"
  | "monthly"
  | "lifetime"
  | "custom";

type RevenueCatPaywallPlan = {
  id: string;
  title: string;
  durationLabel: string;
  price: string;
  subtitle: string;
  badge?: string;
  highlight?: string;
  planKey: RevenueCatPlanKey;
  rcPackage: PurchasesPackage | null;
};

const PLAN_PRIORITY: RevenueCatPlanKey[] = [
  "annual",
  "weekly",
  "monthly",
  "lifetime",
  "custom",
];
const MAX_PAYWALL_PLANS = 2;

const getRevenueCatApiKey = () => {
  if (Platform.OS === "ios") {
    return env.revenueCatIosApiKey;
  }

  if (Platform.OS === "android") {
    return env.revenueCatAndroidApiKey;
  }

  return null;
};

const normalizeAppUserId = (appUserID?: string | null) => {
  const trimmed = appUserID?.trim();
  return trimmed ? trimmed : null;
};

const getPlanKey = (rcPackage: PurchasesPackage): RevenueCatPlanKey => {
  switch (rcPackage.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "annual";
    case PACKAGE_TYPE.WEEKLY:
      return "weekly";
    case PACKAGE_TYPE.MONTHLY:
      return "monthly";
    case PACKAGE_TYPE.LIFETIME:
      return "lifetime";
    default:
      return "custom";
  }
};

const getPlanTitle = (planKey: RevenueCatPlanKey) => {
  switch (planKey) {
    case "annual":
      return "YEARLY";
    case "weekly":
      return "WEEKLY";
    case "monthly":
      return "MONTHLY";
    case "lifetime":
      return "LIFETIME";
    default:
      return "PREMIUM";
  }
};

const getBillingSuffix = (planKey: RevenueCatPlanKey) => {
  switch (planKey) {
    case "annual":
      return "/year";
    case "weekly":
      return "/week";
    case "monthly":
      return "/month";
    case "lifetime":
      return "one-time";
    default:
      return "";
  }
};

const formatPriceWithSuffix = (price: string, suffix?: string | null) => {
  const trimmedSuffix = suffix?.trim();

  if (!trimmedSuffix) {
    return price;
  }

  return trimmedSuffix.startsWith("/") ? `${price}${trimmedSuffix}` : `${price} ${trimmedSuffix}`;
};

const getConfiguredOfferingHighlight = (
  configuredOffering: PaywallOffering
) => {
  if (configuredOffering.key !== "lifetime") {
    return configuredOffering.highlight || undefined;
  }

  if (configuredOffering.purchasedUsersCount > 0) {
    if (configuredOffering.purchaseLimit) {
      return `${configuredOffering.purchasedUsersCount} of ${configuredOffering.purchaseLimit} claimed`;
    }

    return `${configuredOffering.purchasedUsersCount} claimed`;
  }

  return "Be one of the first founding members";
};

const getPlanSubtitle = (
  planKey: RevenueCatPlanKey,
  rcPackage: PurchasesPackage
) => {
  if (planKey === "annual" && rcPackage.product.pricePerMonthString) {
    return `${rcPackage.product.pricePerMonthString}/month equivalent`;
  }

  switch (planKey) {
    case "annual":
      return "Most value";
    case "weekly":
      return "Flexible access";
    case "monthly":
      return "Simple monthly billing";
    case "lifetime":
      return "One-time unlock";
    default:
      return rcPackage.product.title || "Premium access";
  }
};

const getPlanKeyFromOfferingKey = (
  offeringKey?: PaywallOffering["key"]
): RevenueCatPlanKey => {
  switch (offeringKey) {
    case "weekly":
      return "weekly";
    case "monthly":
      return "monthly";
    case "yearly":
      return "annual";
    case "lifetime":
      return "lifetime";
    default:
      return "custom";
  }
};

const getCurrentOffering = (offerings: PurchasesOfferings | null) => {
  if (!offerings) {
    return null;
  }

  if (offerings.current) {
    return offerings.current;
  }

  return Object.values(offerings.all)[0] ?? null;
};

const getPreferredPackages = (offering: PurchasesOffering) => {
  const ordered = [
    offering.annual,
    offering.weekly,
    offering.monthly,
    offering.lifetime,
    ...offering.availablePackages,
  ].filter(Boolean) as PurchasesPackage[];
  const seenIdentifiers = new Set<string>();

  return ordered.filter(rcPackage => {
    if (seenIdentifiers.has(rcPackage.identifier)) {
      return false;
    }

    seenIdentifiers.add(rcPackage.identifier);
    return true;
  });
};

const findRevenueCatPackage = (
  offerings: PurchasesOfferings | null,
  configuredOffering: PaywallOffering
) => {
  if (!offerings) {
    return null;
  }

  const selectedOffering =
    (configuredOffering.revenueCatOfferingId
      ? offerings.all[configuredOffering.revenueCatOfferingId]
      : null) || getCurrentOffering(offerings);

  if (!selectedOffering) {
    return null;
  }

  const preferredPackages = getPreferredPackages(selectedOffering);

  if (configuredOffering.revenueCatPackageId) {
    const exactMatch = preferredPackages.find(
      rcPackage => rcPackage.identifier === configuredOffering.revenueCatPackageId
    );

    if (exactMatch) {
      return exactMatch;
    }
  }

  const fallbackPlanKey = getPlanKeyFromOfferingKey(configuredOffering.key);

  return (
    preferredPackages.find(rcPackage => getPlanKey(rcPackage) === fallbackPlanKey) ||
    null
  );
};

const getMatchingEntitlement = (
  customerInfo: CustomerInfo
): PurchasesEntitlementInfo | null => {
  const entitlementId = env.revenueCatEntitlementId;
  const activeEntitlements = Object.values(customerInfo.entitlements.active);

  if (entitlementId) {
    const exactMatch = customerInfo.entitlements.active[entitlementId] ?? null;

    if (exactMatch) {
      return exactMatch;
    }
  }

  return activeEntitlements[0] ?? null;
};

async function configureRevenueCat(appUserID?: string | null) {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    return false;
  }

  const normalizedAppUserId = normalizeAppUserId(appUserID);
  const isConfigured = await Purchases.isConfigured().catch(() => false);

  if (!isConfigured) {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    Purchases.configure({
      apiKey,
      appUserID: normalizedAppUserId ?? undefined,
      diagnosticsEnabled: __DEV__,
    });

    return true;
  }

  if (!normalizedAppUserId) {
    return true;
  }

  const currentAppUserId = await Purchases.getAppUserID().catch(() => null);

  if (currentAppUserId !== normalizedAppUserId) {
    await Purchases.logIn(normalizedAppUserId);
  }

  return true;
}

async function syncRevenueCatIdentity(appUserID?: string | null) {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    return false;
  }

  const normalizedAppUserId = normalizeAppUserId(appUserID);
  const isConfigured = await Purchases.isConfigured().catch(() => false);

  if (!isConfigured) {
    return configureRevenueCat(normalizedAppUserId);
  }

  if (!normalizedAppUserId) {
    await Purchases.logOut().catch(() => undefined);
    return true;
  }

  const currentAppUserId = await Purchases.getAppUserID().catch(() => null);

  if (currentAppUserId !== normalizedAppUserId) {
    await Purchases.logIn(normalizedAppUserId);
  }

  return true;
}

async function getRevenueCatOfferings(appUserID?: string | null) {
  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    return null;
  }

  return Purchases.getOfferings();
}

async function getRevenueCatCustomerInfo(appUserID?: string | null) {
  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    return null;
  }

  return Purchases.getCustomerInfo();
}

async function purchaseRevenueCatPackage(
  rcPackage: PurchasesPackage,
  appUserID?: string | null
) {
  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    throw new Error("RevenueCat is not configured for this platform.");
  }

  return Purchases.purchasePackage(rcPackage);
}

async function restoreRevenueCatPurchases(appUserID?: string | null) {
  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    throw new Error("RevenueCat is not configured for this platform.");
  }

  return Purchases.restorePurchases();
}

function getRevenueCatPaywallPlans(
  offerings: PurchasesOfferings | null,
  configuredOfferings?: PaywallOffering[]
) {
  if (configuredOfferings?.length) {
    return [...configuredOfferings]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map<RevenueCatPaywallPlan>(configuredOffering => {
        const rcPackage = findRevenueCatPackage(offerings, configuredOffering);
        const planKey = getPlanKeyFromOfferingKey(configuredOffering.key);

        return {
          id: configuredOffering.key,
          title: configuredOffering.title,
          durationLabel: configuredOffering.price,
          price: formatPriceWithSuffix(
            configuredOffering.price,
            configuredOffering.priceSuffix
          ),
          subtitle:
            configuredOffering.subtitle ||
            (rcPackage ? getPlanSubtitle(planKey, rcPackage) : "Premium access"),
          badge: configuredOffering.badge || undefined,
          highlight: getConfiguredOfferingHighlight(configuredOffering),
          planKey,
          rcPackage,
        };
      });
  }

  const offering = getCurrentOffering(offerings);

  if (!offering) {
    return [];
  }

  return getPreferredPackages(offering)
    .map<RevenueCatPaywallPlan>(rcPackage => {
      const planKey = getPlanKey(rcPackage);

      return {
        id: rcPackage.identifier,
        title: getPlanTitle(planKey),
        durationLabel: rcPackage.product.priceString,
        price: formatPriceWithSuffix(
          rcPackage.product.priceString,
          getBillingSuffix(planKey)
        ),
        subtitle: getPlanSubtitle(planKey, rcPackage),
        badge: planKey === "annual" ? "Most Value" : undefined,
        highlight:
          planKey === "annual" && rcPackage.product.pricePerMonthString
            ? `${rcPackage.product.pricePerMonthString}/month`
            : undefined,
        planKey,
        rcPackage,
      };
    })
    .sort(
      (left, right) =>
        PLAN_PRIORITY.indexOf(left.planKey) - PLAN_PRIORITY.indexOf(right.planKey)
    )
    .slice(0, MAX_PAYWALL_PLANS);
}

function hasRevenueCatPremiumAccess(customerInfo: CustomerInfo | null) {
  if (!customerInfo) {
    return false;
  }

  return Boolean(getMatchingEntitlement(customerInfo)?.isActive);
}

function getRevenueCatActiveEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) {
    return null;
  }

  return getMatchingEntitlement(customerInfo);
}

function getRevenueCatConfigurationError() {
  const apiKey = getRevenueCatApiKey();

  if (apiKey) {
    return null;
  }

  return Platform.OS === "ios"
    ? "Add REVENUECAT_IOS_API_KEY to frontend/.env to enable purchases on iOS."
    : "Add REVENUECAT_ANDROID_API_KEY to frontend/.env to enable purchases on Android.";
}

export {
  configureRevenueCat,
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatCustomerInfo,
  getRevenueCatOfferings,
  getRevenueCatPaywallPlans,
  hasRevenueCatPremiumAccess,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  syncRevenueCatIdentity,
};
export type { RevenueCatPaywallPlan };
