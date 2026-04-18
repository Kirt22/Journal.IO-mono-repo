import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesIntroPrice,
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
  introOffer: RevenueCatIntroOffer | null;
};

type RevenueCatIntroOffer = {
  price: string;
  period: string;
  unitCount: number;
  unitLabel: string;
  durationCount: number;
  durationLabel: string;
  cycles: number;
  isFreeTrial: boolean;
};

type RevenueCatOfferingDetails = {
  offerings: PurchasesOfferings;
  currentOffering: PurchasesOffering | null;
  availablePackages: PurchasesPackage[];
};

type RevenueCatEntitlementState = {
  customerInfo: CustomerInfo | null;
  activeEntitlement: PurchasesEntitlementInfo | null;
  hasPremiumAccess: boolean;
};

type RevenueCatPackageMetadata = {
  planKey: RevenueCatPlanKey;
  rcPackage: PurchasesPackage | null;
  revenueCatOfferingId: string | null;
  revenueCatPackageId: string | null;
};

const PLAN_PRIORITY: RevenueCatPlanKey[] = [
  "annual",
  "weekly",
  "monthly",
  "lifetime",
  "custom",
];
const MAX_PAYWALL_PLANS = 2;
const PERIOD_UNIT_LABELS = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
} as const;

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

const parsePriceValue = (priceLabel?: string | null) => {
  if (!priceLabel) {
    return null;
  }

  const normalized = priceLabel.replace(/[^0-9.,]/g, "");

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(
    normalized.includes(".")
      ? normalized.replace(/,/g, "")
      : normalized.replace(",", ".")
  );

  return Number.isFinite(parsed) ? parsed : null;
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

const formatCountLabel = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

const getIntroOfferDurationCount = (introPrice: PurchasesIntroPrice) =>
  introPrice.cycles * introPrice.periodNumberOfUnits;

const getIntroOffer = (
  rcPackage: PurchasesPackage | null
): RevenueCatIntroOffer | null => {
  const introPrice = rcPackage?.product.introPrice;

  if (!introPrice) {
    return null;
  }

  const unitLabel =
    PERIOD_UNIT_LABELS[
      introPrice.periodUnit as keyof typeof PERIOD_UNIT_LABELS
    ] || introPrice.periodUnit.toLowerCase();
  const durationCount = getIntroOfferDurationCount(introPrice);
  const isFreeTrial = introPrice.price === 0;

  return {
    price: introPrice.priceString,
    period: introPrice.period,
    unitCount: introPrice.periodNumberOfUnits,
    unitLabel,
    durationCount,
    durationLabel: formatCountLabel(durationCount, unitLabel),
    cycles: introPrice.cycles,
    isFreeTrial,
  };
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
    case "yearly_exit_offer":
      return "annual";
    case "lifetime":
      return "lifetime";
    default:
      return "custom";
  }
};

const getRevenueCatOfferingIdFromPackage = (
  rcPackage: PurchasesPackage | null
) =>
  rcPackage?.presentedOfferingContext?.offeringIdentifier ||
  rcPackage?.product.presentedOfferingContext?.offeringIdentifier ||
  rcPackage?.product.presentedOfferingIdentifier ||
  null;

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

const getPackagesAcrossAllOfferings = (offerings: PurchasesOfferings | null) => {
  if (!offerings) {
    return [];
  }

  const seenIdentifiers = new Set<string>();
  const currentOffering = getCurrentOffering(offerings);
  const offeringsToSearch = [...Object.values(offerings.all)];

  if (
    currentOffering &&
    !offeringsToSearch.some(offering => offering.identifier === currentOffering.identifier)
  ) {
    offeringsToSearch.unshift(currentOffering);
  }

  return offeringsToSearch.flatMap(offering =>
    getPreferredPackages(offering).filter(rcPackage => {
      const dedupeKey = `${offering.identifier}:${rcPackage.identifier}`;

      if (seenIdentifiers.has(dedupeKey)) {
        return false;
      }

      seenIdentifiers.add(dedupeKey);
      return true;
    })
  );
};

const sortPackagesByAscendingPrice = (packages: PurchasesPackage[]) =>
  [...packages].sort((left, right) => {
    const leftPrice = parsePriceValue(left.product.priceString);
    const rightPrice = parsePriceValue(right.product.priceString);

    if (leftPrice === null && rightPrice === null) {
      return 0;
    }

    if (leftPrice === null) {
      return 1;
    }

    if (rightPrice === null) {
      return -1;
    }

    return leftPrice - rightPrice;
  });

const sortPackagesByPriceDistance = (
  packages: PurchasesPackage[],
  targetPrice: number
) =>
  [...packages].sort((left, right) => {
    const leftPrice = parsePriceValue(left.product.priceString);
    const rightPrice = parsePriceValue(right.product.priceString);

    if (leftPrice === null && rightPrice === null) {
      return 0;
    }

    if (leftPrice === null) {
      return 1;
    }

    if (rightPrice === null) {
      return -1;
    }

    return Math.abs(leftPrice - targetPrice) - Math.abs(rightPrice - targetPrice);
  });

const findRevenueCatPackageByPlanKey = (
  offerings: PurchasesOfferings | null,
  planKey: RevenueCatPlanKey
) => {
  return (
    getPackagesAcrossAllOfferings(offerings).find(
      rcPackage => getPlanKey(rcPackage) === planKey
    ) || null
  );
};

const selectPreferredConfiguredPackage = (
  packages: PurchasesPackage[],
  configuredOffering: PaywallOffering
) => {
  if (!packages.length) {
    return null;
  }

  if (configuredOffering.key === "yearly_exit_offer") {
    const configuredPriceValue = parsePriceValue(configuredOffering.price);

    if (configuredPriceValue !== null) {
      return sortPackagesByPriceDistance(packages, configuredPriceValue)[0] || null;
    }

    return sortPackagesByAscendingPrice(packages)[0] || null;
  }

  return packages[0] || null;
};

const findRevenueCatPackage = (
  offerings: PurchasesOfferings | null,
  configuredOffering: PaywallOffering
) => {
  if (!offerings) {
    return null;
  }

  const candidateOfferings = configuredOffering.revenueCatOfferingId
    ? [offerings.all[configuredOffering.revenueCatOfferingId]].filter(
        Boolean
      ) as PurchasesOffering[]
    : Object.values(offerings.all);

  const preferredPackages = candidateOfferings.flatMap(offering =>
    getPreferredPackages(offering)
  );
  const fallbackPlanKey = getPlanKeyFromOfferingKey(configuredOffering.key);

  if (
    configuredOffering.key === "yearly_exit_offer" &&
    !configuredOffering.revenueCatOfferingId
  ) {
    return selectPreferredConfiguredPackage(
      preferredPackages.filter(
        rcPackage => getPlanKey(rcPackage) === fallbackPlanKey
      ),
      configuredOffering
    );
  }

  if (configuredOffering.revenueCatPackageId) {
    const exactMatches = preferredPackages.filter(
      rcPackage => rcPackage.identifier === configuredOffering.revenueCatPackageId
    );

    const exactMatch = selectPreferredConfiguredPackage(
      exactMatches,
      configuredOffering
    );

    if (exactMatch) {
      return exactMatch;
    }
  }

  return selectPreferredConfiguredPackage(
    preferredPackages.filter(
      rcPackage => getPlanKey(rcPackage) === fallbackPlanKey
    ),
    configuredOffering
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

async function getRevenueCatOfferingDetails(appUserID?: string | null) {
  const offerings = await getRevenueCatOfferings(appUserID);

  if (!offerings) {
    return null;
  }

  const currentOffering = getCurrentOffering(offerings);

  return {
    offerings,
    currentOffering,
    availablePackages: currentOffering ? getPreferredPackages(currentOffering) : [],
  } satisfies RevenueCatOfferingDetails;
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

async function refreshRevenueCatEntitlementState(appUserID?: string | null) {
  const customerInfo = await getRevenueCatCustomerInfo(appUserID);
  const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);

  return {
    customerInfo,
    activeEntitlement,
    hasPremiumAccess: hasRevenueCatPremiumAccess(customerInfo),
  } satisfies RevenueCatEntitlementState;
}

function addRevenueCatCustomerInfoUpdateListener(
  listener: (customerInfo: CustomerInfo) => void
) {
  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

function getRevenueCatPackageMetadataForPlanKey(
  offerings: PurchasesOfferings | null,
  planKey: RevenueCatPlanKey
) {
  const rcPackage = findRevenueCatPackageByPlanKey(offerings, planKey);

  return {
    planKey,
    rcPackage,
    revenueCatOfferingId: getRevenueCatOfferingIdFromPackage(rcPackage),
    revenueCatPackageId: rcPackage?.identifier || null,
  } satisfies RevenueCatPackageMetadata;
}

function getRevenueCatPackagesForPlanKey(
  offerings: PurchasesOfferings | null,
  planKey: RevenueCatPlanKey
) {
  return sortPackagesByAscendingPrice(
    getPackagesAcrossAllOfferings(offerings).filter(
      rcPackage => getPlanKey(rcPackage) === planKey
    )
  );
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
          durationLabel: rcPackage?.product.priceString || configuredOffering.price,
          price: rcPackage
            ? formatPriceWithSuffix(
                rcPackage.product.priceString,
                getBillingSuffix(planKey)
              )
            : formatPriceWithSuffix(
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
          introOffer: getIntroOffer(rcPackage),
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
        introOffer: getIntroOffer(rcPackage),
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

function hasPremiumAccess(customerInfo: CustomerInfo | null) {
  return hasRevenueCatPremiumAccess(customerInfo);
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
  addRevenueCatCustomerInfoUpdateListener,
  configureRevenueCat,
  getIntroOffer,
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatCustomerInfo,
  getRevenueCatOfferingDetails,
  getRevenueCatOfferings,
  getRevenueCatPackageMetadataForPlanKey,
  getRevenueCatPackagesForPlanKey,
  getRevenueCatPaywallPlans,
  hasPremiumAccess,
  hasRevenueCatPremiumAccess,
  purchaseRevenueCatPackage,
  refreshRevenueCatEntitlementState,
  restoreRevenueCatPurchases,
  syncRevenueCatIdentity,
};
export type {
  RevenueCatEntitlementState,
  RevenueCatIntroOffer,
  RevenueCatOfferingDetails,
  RevenueCatPackageMetadata,
  RevenueCatPaywallPlan,
  RevenueCatPlanKey,
};
