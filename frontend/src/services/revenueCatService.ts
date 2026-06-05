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
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
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
  revenueCatOfferingId: string | null;
  revenueCatPackageId: string | null;
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

type RevenueCatHostedPaywallTarget = "main" | "exit";

type RevenueCatPlanSelectionContext = {
  placementKey?: string | null;
};

const DEFAULT_MAIN_PAYWALL_OFFERING_ID =
  "journalio_offering_post_onboarding_standard";
const DEFAULT_EXIT_PAYWALL_OFFERING_ID =
  "journalio_offering_post_onboarding_exit";
const DEFAULT_OTHER_SCREENS_OFFERING_ID =
  "journalio_offering_other_screens_standard";
const DEFAULT_LIFETIME_OFFERING_ID = "journalio_offering_lifetime";

type RevenueCatHostedPaywallResult = {
  status: "purchased" | "restored" | "cancelled" | "notPresented" | "error";
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  offering: PurchasesOffering | null;
  error?: unknown;
  message?: string;
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

const REVENUECAT_DEBUG_PREFIX = "[RevenueCatDebug]";

const shouldLogRevenueCatDebug = () => __DEV__;

const redactValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const logRevenueCatDebug = (event: string, data?: Record<string, unknown>) => {
  if (!shouldLogRevenueCatDebug()) {
    return;
  }

  console.info(`${REVENUECAT_DEBUG_PREFIX} ${event}`, data ?? {});
};

const logRevenueCatWarn = (event: string, data?: Record<string, unknown>) => {
  if (!shouldLogRevenueCatDebug()) {
    return;
  }

  console.warn(`${REVENUECAT_DEBUG_PREFIX} ${event}`, data ?? {});
};

const getSummerOfferPaywallOfferingId = () =>
  env.revenueCatOtherScreensOfferingId || DEFAULT_OTHER_SCREENS_OFFERING_ID;

const getExitOfferPaywallOfferingId = () => {
  const configuredExitOfferingId = env.revenueCatExitPaywallOfferingId;
  const summerOfferPaywallOfferingId = getSummerOfferPaywallOfferingId();

  if (
    configuredExitOfferingId &&
    configuredExitOfferingId !== summerOfferPaywallOfferingId &&
    configuredExitOfferingId !== DEFAULT_OTHER_SCREENS_OFFERING_ID
  ) {
    return configuredExitOfferingId;
  }

  return DEFAULT_EXIT_PAYWALL_OFFERING_ID;
};

const summarizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === "object" && error !== null) {
    const errorRecord = error as Record<string, unknown>;

    return {
      code: errorRecord.code,
      message: errorRecord.message,
      readableErrorCode: errorRecord.readableErrorCode,
      underlyingErrorMessage: errorRecord.underlyingErrorMessage,
    };
  }

  return {
    message: String(error),
  };
};

const summarizeEnv = () => ({
  platform: Platform.OS,
  platformVersion: Platform.Version,
  isDev: __DEV__,
  hasIosApiKey: Boolean(env.revenueCatIosApiKey),
  iosApiKeyPrefix: redactValue(env.revenueCatIosApiKey),
  hasAndroidApiKey: Boolean(env.revenueCatAndroidApiKey),
  androidApiKeyPrefix: redactValue(env.revenueCatAndroidApiKey),
  entitlementId: env.revenueCatEntitlementId,
  standardOfferingId:
    env.revenueCatMainPaywallOfferingId || DEFAULT_MAIN_PAYWALL_OFFERING_ID,
  mainOfferingId: getSummerOfferPaywallOfferingId(),
  exitOfferingId: getExitOfferPaywallOfferingId(),
  otherScreensOfferingId:
    env.revenueCatOtherScreensOfferingId || DEFAULT_OTHER_SCREENS_OFFERING_ID,
  lifetimeOfferingId: env.revenueCatLifetimeOfferingId || DEFAULT_LIFETIME_OFFERING_ID,
});

const summarizeProduct = (rcPackage: PurchasesPackage) => ({
  packageIdentifier: rcPackage.identifier,
  packageType: rcPackage.packageType,
  productIdentifier: rcPackage.product.identifier,
  productTitle: rcPackage.product.title,
  productDescription: rcPackage.product.description,
  price: rcPackage.product.price,
  priceString: rcPackage.product.priceString,
  currencyCode: rcPackage.product.currencyCode,
  pricePerMonthString: rcPackage.product.pricePerMonthString,
  introPrice: rcPackage.product.introPrice
    ? {
        price: rcPackage.product.introPrice.price,
        priceString: rcPackage.product.introPrice.priceString,
        period: rcPackage.product.introPrice.period,
        periodUnit: rcPackage.product.introPrice.periodUnit,
        periodNumberOfUnits:
          rcPackage.product.introPrice.periodNumberOfUnits,
        cycles: rcPackage.product.introPrice.cycles,
      }
    : null,
  presentedOfferingIdentifier: getRevenueCatOfferingIdFromPackage(rcPackage),
});

const summarizeOffering = (offering: PurchasesOffering | null) => {
  if (!offering) {
    return null;
  }

  return {
    identifier: offering.identifier,
    serverDescription: offering.serverDescription,
    packageCount: offering.availablePackages.length,
    packageIdentifiers: offering.availablePackages.map(
      rcPackage => rcPackage.identifier
    ),
    productIdentifiers: offering.availablePackages.map(
      rcPackage => rcPackage.product.identifier
    ),
    annualProductIdentifier: offering.annual?.product.identifier ?? null,
    weeklyProductIdentifier: offering.weekly?.product.identifier ?? null,
    monthlyProductIdentifier: offering.monthly?.product.identifier ?? null,
    lifetimeProductIdentifier: offering.lifetime?.product.identifier ?? null,
  };
};

const summarizeOfferings = (offerings: PurchasesOfferings | null) => {
  if (!offerings) {
    return null;
  }

  const offeringSummaries = Object.values(offerings.all).map(summarizeOffering);

  return {
    currentOfferingId: offerings.current?.identifier ?? null,
    allOfferingIds: Object.keys(offerings.all),
    offeringCount: Object.keys(offerings.all).length,
    totalPackageCount: offeringSummaries.reduce(
      (count, offering) => count + (offering?.packageCount ?? 0),
      0
    ),
    offerings: offeringSummaries,
  };
};

const summarizeCustomerInfo = (customerInfo: CustomerInfo | null) => {
  if (!customerInfo) {
    return null;
  }

  return {
    originalAppUserId: redactValue(customerInfo.originalAppUserId),
    activeEntitlementIds: Object.keys(customerInfo.entitlements.active),
    allEntitlementIds: Object.keys(customerInfo.entitlements.all),
    activeSubscriptionIds: customerInfo.activeSubscriptions,
    allPurchasedProductIds: customerInfo.allPurchasedProductIdentifiers,
    managementUrl: customerInfo.managementURL ? "present" : null,
    latestExpirationDate: customerInfo.latestExpirationDate,
  };
};

const getRevenueCatApiKey = () => {
  if (Platform.OS === "ios") {
    return env.revenueCatIosApiKey;
  }

  if (Platform.OS === "android") {
    return env.revenueCatAndroidApiKey;
  }

  return null;
};

const getRevenueCatHostedOfferingId = (
  target: RevenueCatHostedPaywallTarget,
  _placementKey?: string | null
) =>
  target === "main"
    ? getSummerOfferPaywallOfferingId()
    : getExitOfferPaywallOfferingId();

const getDedicatedRevenueCatOfferingId = (
  configuredOffering: PaywallOffering,
  context?: RevenueCatPlanSelectionContext
) => {
  if (configuredOffering.key === "lifetime") {
    return env.revenueCatLifetimeOfferingId || DEFAULT_LIFETIME_OFFERING_ID;
  }

  if (
    configuredOffering.key === "yearly_exit_offer" ||
    context?.placementKey === "post_auth_exit_offer"
  ) {
    return getExitOfferPaywallOfferingId();
  }

  if (context?.placementKey === "post_auth") {
    return getSummerOfferPaywallOfferingId();
  }

  if (
    configuredOffering.key === "weekly" ||
    configuredOffering.key === "monthly" ||
    configuredOffering.key === "yearly"
  ) {
    return (
      env.revenueCatOtherScreensOfferingId || DEFAULT_OTHER_SCREENS_OFFERING_ID
    );
  }

  return configuredOffering.revenueCatOfferingId || null;
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
  const matchedPackage =
    getPackagesAcrossAllOfferings(offerings).find(
      rcPackage => getPlanKey(rcPackage) === planKey
    ) || null;

  logRevenueCatDebug("find package by plan key", {
    planKey,
    matchedPackage: matchedPackage ? summarizeProduct(matchedPackage) : null,
  });

  return matchedPackage;
};

const findRevenueCatPackageByProductIdentifier = (
  offerings: PurchasesOfferings | null,
  productIdentifier?: string | null
) => {
  if (!productIdentifier) {
    logRevenueCatDebug("skip product lookup: missing product identifier");
    return null;
  }

  const matchedPackage =
    getPackagesAcrossAllOfferings(offerings).find(
      rcPackage => rcPackage.product.identifier === productIdentifier
    ) || null;

  logRevenueCatDebug("find package by product identifier", {
    productIdentifier,
    matchedPackage: matchedPackage ? summarizeProduct(matchedPackage) : null,
  });

  return matchedPackage;
};

const selectPreferredConfiguredPackage = (
  packages: PurchasesPackage[],
  configuredOffering: PaywallOffering
) => {
  if (!packages.length) {
    logRevenueCatWarn("package selection failed: no candidate packages", {
      configuredOfferingKey: configuredOffering.key,
      configuredRevenueCatOfferingId: configuredOffering.revenueCatOfferingId,
      configuredRevenueCatPackageId: configuredOffering.revenueCatPackageId,
      configuredPrice: configuredOffering.price,
    });
    return null;
  }

  if (configuredOffering.key === "yearly_exit_offer") {
    const configuredPriceValue = parsePriceValue(configuredOffering.price);

    if (configuredPriceValue !== null) {
      const selectedPackage =
        sortPackagesByPriceDistance(packages, configuredPriceValue)[0] || null;

      logRevenueCatDebug("selected yearly exit package by price distance", {
        configuredPrice: configuredOffering.price,
        configuredPriceValue,
        selectedPackage: selectedPackage
          ? summarizeProduct(selectedPackage)
          : null,
        candidatePackages: packages.map(summarizeProduct),
      });

      return selectedPackage;
    }

    const selectedPackage = sortPackagesByAscendingPrice(packages)[0] || null;

    logRevenueCatDebug("selected yearly exit package by ascending price", {
      configuredPrice: configuredOffering.price,
      selectedPackage: selectedPackage ? summarizeProduct(selectedPackage) : null,
      candidatePackages: packages.map(summarizeProduct),
    });

    return selectedPackage;
  }

  const selectedPackage = packages[0] || null;

  logRevenueCatDebug("selected configured package", {
    configuredOfferingKey: configuredOffering.key,
    configuredRevenueCatOfferingId: configuredOffering.revenueCatOfferingId,
    configuredRevenueCatPackageId: configuredOffering.revenueCatPackageId,
    selectedPackage: selectedPackage ? summarizeProduct(selectedPackage) : null,
    candidatePackages: packages.map(summarizeProduct),
  });

  return selectedPackage;
};

const findRevenueCatPackage = (
  offerings: PurchasesOfferings | null,
  configuredOffering: PaywallOffering,
  context?: RevenueCatPlanSelectionContext
) => {
  if (!offerings) {
    logRevenueCatWarn("package lookup failed: offerings unavailable", {
      configuredOfferingKey: configuredOffering.key,
      contextPlacementKey: context?.placementKey,
    });
    return null;
  }

  const targetOfferingId = getDedicatedRevenueCatOfferingId(
    configuredOffering,
    context
  );
  const candidateOfferings = targetOfferingId
    ? [offerings.all[targetOfferingId]].filter(
        Boolean
      ) as PurchasesOffering[]
    : Object.values(offerings.all);

  const preferredPackages = candidateOfferings.flatMap(offering =>
    getPreferredPackages(offering)
  );
  const fallbackPlanKey = getPlanKeyFromOfferingKey(configuredOffering.key);

  logRevenueCatDebug("find configured package candidates", {
    configuredOfferingKey: configuredOffering.key,
    configuredRevenueCatOfferingId: configuredOffering.revenueCatOfferingId,
    configuredRevenueCatPackageId: configuredOffering.revenueCatPackageId,
    configuredPrice: configuredOffering.price,
    contextPlacementKey: context?.placementKey,
    targetOfferingId,
    foundTargetOffering: targetOfferingId
      ? Boolean(offerings.all[targetOfferingId])
      : null,
    candidateOfferingIds: candidateOfferings.map(offering => offering.identifier),
    fallbackPlanKey,
    preferredPackages: preferredPackages.map(summarizeProduct),
  });

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

  logRevenueCatDebug("configure requested", {
    env: summarizeEnv(),
    providedAppUserId: redactValue(appUserID),
  });

  if (!apiKey) {
    logRevenueCatWarn("configure skipped: missing platform API key", {
      env: summarizeEnv(),
    });
    return false;
  }

  const normalizedAppUserId = normalizeAppUserId(appUserID);
  const isConfigured = await Purchases.isConfigured().catch(() => false);

  logRevenueCatDebug("configure status", {
    isConfigured,
    normalizedAppUserId: redactValue(normalizedAppUserId),
  });

  if (!isConfigured) {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    Purchases.configure({
      apiKey,
      appUserID: normalizedAppUserId ?? undefined,
      diagnosticsEnabled: __DEV__,
    });

    logRevenueCatDebug("configured SDK", {
      apiKeyPrefix: redactValue(apiKey),
      appUserId: redactValue(normalizedAppUserId),
      diagnosticsEnabled: __DEV__,
      logLevel: __DEV__ ? "DEBUG" : "INFO",
    });

    return true;
  }

  if (!normalizedAppUserId) {
    logRevenueCatDebug("configure complete: already configured anonymous user");
    return true;
  }

  const currentAppUserId = await Purchases.getAppUserID().catch(() => null);

  if (currentAppUserId !== normalizedAppUserId) {
    logRevenueCatDebug("logging in configured SDK user", {
      currentAppUserId: redactValue(currentAppUserId),
      nextAppUserId: redactValue(normalizedAppUserId),
    });
    await Purchases.logIn(normalizedAppUserId);
  } else {
    logRevenueCatDebug("configured SDK already has requested user", {
      currentAppUserId: redactValue(currentAppUserId),
    });
  }

  return true;
}

async function syncRevenueCatIdentity(appUserID?: string | null) {
  const apiKey = getRevenueCatApiKey();

  logRevenueCatDebug("identity sync requested", {
    providedAppUserId: redactValue(appUserID),
    hasApiKey: Boolean(apiKey),
  });

  if (!apiKey) {
    logRevenueCatWarn("identity sync skipped: missing platform API key", {
      env: summarizeEnv(),
    });
    return false;
  }

  const normalizedAppUserId = normalizeAppUserId(appUserID);
  const isConfigured = await Purchases.isConfigured().catch(() => false);

  logRevenueCatDebug("identity sync status", {
    isConfigured,
    normalizedAppUserId: redactValue(normalizedAppUserId),
  });

  if (!isConfigured) {
    return configureRevenueCat(normalizedAppUserId);
  }

  if (!normalizedAppUserId) {
    logRevenueCatDebug("logging out RevenueCat user for anonymous state");
    await Purchases.logOut().catch(() => undefined);
    return true;
  }

  const currentAppUserId = await Purchases.getAppUserID().catch(() => null);

  if (currentAppUserId !== normalizedAppUserId) {
    logRevenueCatDebug("logging in RevenueCat user during identity sync", {
      currentAppUserId: redactValue(currentAppUserId),
      nextAppUserId: redactValue(normalizedAppUserId),
    });
    await Purchases.logIn(normalizedAppUserId);
  } else {
    logRevenueCatDebug("identity sync no-op: already logged in", {
      currentAppUserId: redactValue(currentAppUserId),
    });
  }

  return true;
}

async function getRevenueCatOfferings(appUserID?: string | null) {
  logRevenueCatDebug("offerings fetch requested", {
    appUserId: redactValue(appUserID),
    env: summarizeEnv(),
  });

  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    logRevenueCatWarn("offerings fetch skipped: SDK not configured");
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();

    logRevenueCatDebug("offerings fetch succeeded", {
      summary: summarizeOfferings(offerings),
    });

    if (!Object.keys(offerings.all).length) {
      logRevenueCatWarn("offerings fetch returned no offerings");
    }

    const totalPackages = Object.values(offerings.all).reduce(
      (count, offering) => count + offering.availablePackages.length,
      0
    );

    if (totalPackages === 0) {
      logRevenueCatWarn("offerings fetch returned zero packages", {
        summary: summarizeOfferings(offerings),
        expectedProductIds: [
          "app.journalio.premium.weekly",
          "app.journalio.premium.yearly",
          "app.journalio.premium.yearly.exit",
          "app.journalio.premium.lifetime",
        ],
        likelyCauses: [
          "StoreKit configuration file is not active for this run",
          "App Store Connect products are still READY_TO_SUBMIT",
          "Product IDs differ between RevenueCat, StoreKit config, and App Store Connect",
        ],
      });
    }

    return offerings;
  } catch (error) {
    logRevenueCatWarn("offerings fetch failed", {
      error: summarizeError(error),
      env: summarizeEnv(),
      expectedProductIds: [
        "app.journalio.premium.weekly",
        "app.journalio.premium.yearly",
        "app.journalio.premium.yearly.exit",
        "app.journalio.premium.lifetime",
      ],
      nextChecks: [
        "Confirm Xcode Run scheme uses JournalIO.storekit",
        "Confirm app was launched from Xcode Play, not npm run ios",
        "Confirm App Store Connect IAPs have been submitted with the app version",
      ],
    });

    throw error;
  }
}

async function getRevenueCatHostedOffering(
  target: RevenueCatHostedPaywallTarget,
  placementKey?: string | null,
  appUserID?: string | null
) {
  const offeringId = getRevenueCatHostedOfferingId(target, placementKey);

  logRevenueCatDebug("hosted offering requested", {
    target,
    placementKey,
    resolvedOfferingId: offeringId,
    appUserId: redactValue(appUserID),
  });

  const offerings = await getRevenueCatOfferings(appUserID);
  const offering =
    offeringId && offerings ? offerings.all[offeringId] ?? null : null;

  logRevenueCatDebug("hosted offering resolved", {
    target,
    placementKey,
    resolvedOfferingId: offeringId,
    foundOffering: Boolean(offering),
    offering: summarizeOffering(offering),
    allOfferings: summarizeOfferings(offerings),
  });

  return {
    offeringId,
    offerings,
    offering,
  };
}

async function getRevenueCatOfferingDetails(appUserID?: string | null) {
  const offerings = await getRevenueCatOfferings(appUserID);

  if (!offerings) {
    return null;
  }

  const currentOffering = getCurrentOffering(offerings);

  logRevenueCatDebug("offering details resolved", {
    currentOffering: summarizeOffering(currentOffering),
    availablePackages: currentOffering
      ? getPreferredPackages(currentOffering).map(summarizeProduct)
      : [],
  });

  return {
    offerings,
    currentOffering,
    availablePackages: currentOffering ? getPreferredPackages(currentOffering) : [],
  } satisfies RevenueCatOfferingDetails;
}

async function getRevenueCatCustomerInfo(appUserID?: string | null) {
  logRevenueCatDebug("customer info fetch requested", {
    appUserId: redactValue(appUserID),
  });

  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    logRevenueCatWarn("customer info fetch skipped: SDK not configured");
    return null;
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();

    logRevenueCatDebug("customer info fetch succeeded", {
      customerInfo: summarizeCustomerInfo(customerInfo),
    });

    return customerInfo;
  } catch (error) {
    logRevenueCatWarn("customer info fetch failed", {
      error: summarizeError(error),
    });

    throw error;
  }
}

async function purchaseRevenueCatPackage(
  rcPackage: PurchasesPackage,
  appUserID?: string | null
) {
  logRevenueCatDebug("purchase requested", {
    appUserId: redactValue(appUserID),
    rcPackage: summarizeProduct(rcPackage),
  });

  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    logRevenueCatWarn("purchase blocked: SDK not configured");
    throw new Error("Purchases are not available right now.");
  }

  try {
    const result = await Purchases.purchasePackage(rcPackage);

    logRevenueCatDebug("purchase succeeded", {
      rcPackage: summarizeProduct(rcPackage),
      customerInfo: summarizeCustomerInfo(result.customerInfo),
    });

    return result;
  } catch (error) {
    logRevenueCatWarn("purchase failed", {
      rcPackage: summarizeProduct(rcPackage),
      error: summarizeError(error),
    });

    throw error;
  }
}

async function restoreRevenueCatPurchases(appUserID?: string | null) {
  logRevenueCatDebug("restore requested", {
    appUserId: redactValue(appUserID),
  });

  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    logRevenueCatWarn("restore blocked: SDK not configured");
    throw new Error("Purchases are not available right now.");
  }

  try {
    const customerInfo = await Purchases.restorePurchases();

    logRevenueCatDebug("restore succeeded", {
      customerInfo: summarizeCustomerInfo(customerInfo),
    });

    return customerInfo;
  } catch (error) {
    logRevenueCatWarn("restore failed", {
      error: summarizeError(error),
    });

    throw error;
  }
}

function hasRevenueCatHostedPaywall(target: RevenueCatHostedPaywallTarget) {
  return Boolean(getRevenueCatHostedOfferingId(target));
}

async function presentRevenueCatHostedPaywall(
  target: RevenueCatHostedPaywallTarget,
  placementKey?: string | null,
  appUserID?: string | null
) {
  logRevenueCatDebug("hosted paywall presentation requested", {
    target,
    placementKey,
    appUserId: redactValue(appUserID),
  });

  const configured = await configureRevenueCat(appUserID);

  if (!configured) {
    logRevenueCatWarn("hosted paywall blocked: SDK not configured", {
      target,
      placementKey,
    });
    return {
      status: "error",
      customerInfo: null,
      offerings: null,
      offering: null,
      message: "Purchases are not available right now.",
    } satisfies RevenueCatHostedPaywallResult;
  }

  const { offering, offerings } = await getRevenueCatHostedOffering(
    target,
    placementKey,
    appUserID
  );

  if (!offering) {
    logRevenueCatWarn("hosted paywall not presented: offering missing", {
      target,
      placementKey,
      offerings: summarizeOfferings(offerings),
    });

    return {
      status: "notPresented",
      customerInfo: null,
      offerings,
      offering: null,
      message: "This paywall is not configured yet.",
    } satisfies RevenueCatHostedPaywallResult;
  }

  try {
    logRevenueCatDebug("presenting hosted paywall", {
      target,
      placementKey,
      offering: summarizeOffering(offering),
    });

    const paywallResult = await RevenueCatUI.presentPaywall({
      offering,
    });

    logRevenueCatDebug("hosted paywall result", {
      target,
      placementKey,
      paywallResult,
    });

    if (paywallResult === PAYWALL_RESULT.PURCHASED) {
      return {
        status: "purchased",
        customerInfo: await getRevenueCatCustomerInfo(appUserID),
        offerings,
        offering,
      } satisfies RevenueCatHostedPaywallResult;
    }

    if (paywallResult === PAYWALL_RESULT.RESTORED) {
      return {
        status: "restored",
        customerInfo: await getRevenueCatCustomerInfo(appUserID),
        offerings,
        offering,
      } satisfies RevenueCatHostedPaywallResult;
    }

    if (paywallResult === PAYWALL_RESULT.CANCELLED) {
      return {
        status: "cancelled",
        customerInfo: null,
        offerings,
        offering,
      } satisfies RevenueCatHostedPaywallResult;
    }

    if (paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
      return {
        status: "notPresented",
        customerInfo: null,
        offerings,
        offering,
      } satisfies RevenueCatHostedPaywallResult;
    }

    return {
      status: "error",
      customerInfo: null,
      offerings,
      offering,
      message: "We could not open purchases right now.",
    } satisfies RevenueCatHostedPaywallResult;
  } catch (error) {
    logRevenueCatWarn("hosted paywall presentation failed", {
      target,
      placementKey,
      error: summarizeError(error),
    });

    return {
      status: "error",
      customerInfo: null,
      offerings,
      offering,
      error,
      message:
        error instanceof Error
          ? error.message
          : "We could not open purchases right now.",
    } satisfies RevenueCatHostedPaywallResult;
  }
}

async function refreshRevenueCatEntitlementState(appUserID?: string | null) {
  logRevenueCatDebug("entitlement refresh requested", {
    appUserId: redactValue(appUserID),
    expectedEntitlementId: env.revenueCatEntitlementId,
  });

  const customerInfo = await getRevenueCatCustomerInfo(appUserID);
  const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);

  logRevenueCatDebug("entitlement refresh resolved", {
    customerInfo: summarizeCustomerInfo(customerInfo),
    activeEntitlementId: activeEntitlement?.identifier ?? null,
    activeEntitlementStore: activeEntitlement?.store ?? null,
    hasPremiumAccess: hasRevenueCatPremiumAccess(customerInfo),
  });

  return {
    customerInfo,
    activeEntitlement,
    hasPremiumAccess: hasRevenueCatPremiumAccess(customerInfo),
  } satisfies RevenueCatEntitlementState;
}

function addRevenueCatCustomerInfoUpdateListener(
  listener: (customerInfo: CustomerInfo) => void
) {
  logRevenueCatDebug("customer info listener registered");

  const debugListener = (customerInfo: CustomerInfo) => {
    logRevenueCatDebug("customer info listener update received", {
      customerInfo: summarizeCustomerInfo(customerInfo),
    });
    listener(customerInfo);
  };

  Purchases.addCustomerInfoUpdateListener(debugListener);

  return () => {
    logRevenueCatDebug("customer info listener removed");
    Purchases.removeCustomerInfoUpdateListener(debugListener);
  };
}

function getRevenueCatPackageMetadataForPlanKey(
  offerings: PurchasesOfferings | null,
  planKey: RevenueCatPlanKey
) {
  const rcPackage = findRevenueCatPackageByPlanKey(offerings, planKey);

  logRevenueCatDebug("package metadata resolved", {
    planKey,
    rcPackage: rcPackage ? summarizeProduct(rcPackage) : null,
  });

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
  const packages = sortPackagesByAscendingPrice(
    getPackagesAcrossAllOfferings(offerings).filter(
      rcPackage => getPlanKey(rcPackage) === planKey
    )
  );

  logRevenueCatDebug("packages resolved for plan key", {
    planKey,
    packageCount: packages.length,
    packages: packages.map(summarizeProduct),
  });

  return packages;
}

function getRevenueCatPaywallPlans(
  offerings: PurchasesOfferings | null,
  configuredOfferings?: PaywallOffering[],
  context?: RevenueCatPlanSelectionContext
) {
  logRevenueCatDebug("paywall plans requested", {
    configuredOfferingKeys: configuredOfferings?.map(offering => offering.key) ?? [],
    contextPlacementKey: context?.placementKey,
    offerings: summarizeOfferings(offerings),
  });

  if (configuredOfferings?.length) {
    const plans = [...configuredOfferings]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map<RevenueCatPaywallPlan>(configuredOffering => {
        const rcPackage = findRevenueCatPackage(
          offerings,
          configuredOffering,
          context
        );
        const planKey = getPlanKeyFromOfferingKey(configuredOffering.key);
        const resolvedOfferingId = getDedicatedRevenueCatOfferingId(
          configuredOffering,
          context
        );

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
          revenueCatOfferingId:
            getRevenueCatOfferingIdFromPackage(rcPackage) ||
            resolvedOfferingId,
          revenueCatPackageId: rcPackage?.identifier || null,
          rcPackage,
          introOffer: getIntroOffer(rcPackage),
        };
      });

    logRevenueCatDebug("configured paywall plans resolved", {
      plans: plans.map(plan => ({
        id: plan.id,
        planKey: plan.planKey,
        price: plan.price,
        revenueCatOfferingId: plan.revenueCatOfferingId,
        revenueCatPackageId: plan.revenueCatPackageId,
        hasPackage: Boolean(plan.rcPackage),
        productIdentifier: plan.rcPackage?.product.identifier ?? null,
        introOffer: plan.introOffer,
      })),
    });

    return plans;
  }

  const offering = getCurrentOffering(offerings);

  if (!offering) {
    logRevenueCatWarn("paywall plans unavailable: no current offering", {
      offerings: summarizeOfferings(offerings),
    });
    return [];
  }

  const plans = getPreferredPackages(offering)
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
        revenueCatOfferingId: getRevenueCatOfferingIdFromPackage(rcPackage),
        revenueCatPackageId: rcPackage.identifier,
        rcPackage,
        introOffer: getIntroOffer(rcPackage),
      };
    })
    .sort(
      (left, right) =>
        PLAN_PRIORITY.indexOf(left.planKey) - PLAN_PRIORITY.indexOf(right.planKey)
    )
    .slice(0, MAX_PAYWALL_PLANS);

  logRevenueCatDebug("default paywall plans resolved", {
    currentOffering: summarizeOffering(offering),
    plans: plans.map(plan => ({
      id: plan.id,
      planKey: plan.planKey,
      price: plan.price,
      revenueCatOfferingId: plan.revenueCatOfferingId,
      revenueCatPackageId: plan.revenueCatPackageId,
      productIdentifier: plan.rcPackage?.product.identifier ?? null,
      introOffer: plan.introOffer,
    })),
  });

  return plans;
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

  return "Purchases are not available right now. Please try again a little later.";
}

export {
  addRevenueCatCustomerInfoUpdateListener,
  configureRevenueCat,
  getIntroOffer,
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatCustomerInfo,
  getRevenueCatHostedOffering,
  getRevenueCatHostedOfferingId,
  getRevenueCatOfferingDetails,
  getRevenueCatOfferings,
  findRevenueCatPackageByProductIdentifier,
  getRevenueCatPackageMetadataForPlanKey,
  getRevenueCatPackagesForPlanKey,
  getRevenueCatPaywallPlans,
  hasPremiumAccess,
  hasRevenueCatHostedPaywall,
  hasRevenueCatPremiumAccess,
  presentRevenueCatHostedPaywall,
  purchaseRevenueCatPackage,
  refreshRevenueCatEntitlementState,
  restoreRevenueCatPurchases,
  syncRevenueCatIdentity,
};
export type {
  RevenueCatEntitlementState,
  RevenueCatHostedPaywallResult,
  RevenueCatHostedPaywallTarget,
  RevenueCatIntroOffer,
  RevenueCatOfferingDetails,
  RevenueCatPackageMetadata,
  RevenueCatPaywallPlan,
  RevenueCatPlanKey,
};
