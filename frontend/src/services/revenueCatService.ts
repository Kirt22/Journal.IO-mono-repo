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
import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERINGS,
  REVENUECAT_PRODUCTS,
} from "../config/revenueCat";
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

type RevenueCatPurchaseAttribution = {
  activeEntitlement: PurchasesEntitlementInfo;
  offeringKey: PaywallOffering["key"];
  productIdentifier: string;
  revenueCatOfferingId: string;
  revenueCatPackageId: string;
  rcPackage: PurchasesPackage | null;
};

type RevenueCatHostedPaywallTarget = "main" | "exit";

type RevenueCatPlanSelectionContext = {
  placementKey?: string | null;
};

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
  entitlementId: REVENUECAT_ENTITLEMENT_ID,
  standardOfferingId: REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD,
  summerOfferingId: REVENUECAT_OFFERINGS.SUMMER_OFFER,
  lifetimeOfferingId: REVENUECAT_OFFERINGS.LIFETIME,
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
) => {
  if (target === "exit") {
    return REVENUECAT_OFFERINGS.SUMMER_OFFER;
  }

  return REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD;
};

const getDedicatedRevenueCatOfferingId = (
  configuredOffering: PaywallOffering,
  context?: RevenueCatPlanSelectionContext
) => {
  if (configuredOffering.key === "lifetime") {
    return REVENUECAT_OFFERINGS.LIFETIME;
  }

  if (
    configuredOffering.key === "yearly_exit_offer" ||
    context?.placementKey === "post_auth_exit_offer"
  ) {
    return REVENUECAT_OFFERINGS.SUMMER_OFFER;
  }

  if (context?.placementKey === "post_auth") {
    return REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD;
  }

  if (
    configuredOffering.key === "weekly" ||
    configuredOffering.key === "monthly" ||
    configuredOffering.key === "yearly"
  ) {
    return REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD;
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

const getProductIdentifierForOfferingKey = (
  offeringKey?: PaywallOffering["key"]
) => {
  switch (offeringKey) {
    case "weekly":
      return REVENUECAT_PRODUCTS.WEEKLY;
    case "yearly":
      return REVENUECAT_PRODUCTS.YEARLY;
    case "yearly_exit_offer":
      return REVENUECAT_PRODUCTS.YEARLY_DISCOUNT;
    case "lifetime":
      return REVENUECAT_PRODUCTS.LIFETIME;
    default:
      return null;
  }
};

const getProductIdentifierForPlanKey = (planKey: RevenueCatPlanKey) => {
  switch (planKey) {
    case "weekly":
      return REVENUECAT_PRODUCTS.WEEKLY;
    case "annual":
      return REVENUECAT_PRODUCTS.YEARLY;
    case "lifetime":
      return REVENUECAT_PRODUCTS.LIFETIME;
    default:
      return null;
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

const getOfferingById = (
  offerings: PurchasesOfferings | null,
  offeringId: string
) => offerings?.all[offeringId] ?? null;

const getPackagesForOffering = (
  offerings: PurchasesOfferings | null,
  offeringId: string
) => {
  const offering = getOfferingById(offerings, offeringId);

  if (!offering) {
    logRevenueCatWarn("expected offering missing", {
      expectedOfferingId: offeringId,
      availableOfferingIds: offerings ? Object.keys(offerings.all) : [],
    });
    return [];
  }

  return getPreferredPackages(offering);
};

const getPackageByProductId = (
  offerings: PurchasesOfferings | null,
  offeringId: string,
  productIdentifier: string
) => {
  const packages = getPackagesForOffering(offerings, offeringId);
  const matchedPackage =
    packages.find(
      rcPackage => rcPackage.product.identifier === productIdentifier
    ) ?? null;

  if (!matchedPackage) {
    logRevenueCatWarn("expected product missing from offering", {
      expectedOfferingId: offeringId,
      expectedProductId: productIdentifier,
      actualProductIds: packages.map(
        rcPackage => rcPackage.product.identifier
      ),
    });
  }

  return matchedPackage;
};

const getRevenueCatOfferingKeyForProductIdentifier = (
  productIdentifier?: string | null
): PaywallOffering["key"] | null => {
  switch (productIdentifier) {
    case REVENUECAT_PRODUCTS.WEEKLY:
      return "weekly";
    case REVENUECAT_PRODUCTS.YEARLY:
      return "yearly";
    case REVENUECAT_PRODUCTS.YEARLY_DISCOUNT:
      return "yearly_exit_offer";
    case REVENUECAT_PRODUCTS.LIFETIME:
      return "lifetime";
    default:
      return null;
  }
};

const getDefaultOfferingIdForOfferingKey = (
  offeringKey: PaywallOffering["key"]
) => {
  switch (offeringKey) {
    case "yearly_exit_offer":
      return REVENUECAT_OFFERINGS.SUMMER_OFFER;
    case "lifetime":
      return REVENUECAT_OFFERINGS.LIFETIME;
    case "weekly":
    case "yearly":
    case "monthly":
    default:
      return REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD;
  }
};

const findRevenueCatPackageByPlanKey = (
  offerings: PurchasesOfferings | null,
  planKey: RevenueCatPlanKey
) => {
  const productIdentifier = getProductIdentifierForPlanKey(planKey);
  const matchedPackage =
    (productIdentifier
      ? getPackagesAcrossAllOfferings(offerings).find(
          rcPackage => rcPackage.product.identifier === productIdentifier
        )
      : null) || null;

  logRevenueCatDebug("find package by plan key", {
    planKey,
    expectedProductIdentifier: productIdentifier,
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
  const productIdentifier = getProductIdentifierForOfferingKey(
    configuredOffering.key
  );

  logRevenueCatDebug("find exact configured package", {
    configuredOfferingKey: configuredOffering.key,
    contextPlacementKey: context?.placementKey,
    targetOfferingId,
    productIdentifier,
  });

  if (!targetOfferingId || !productIdentifier) {
    logRevenueCatWarn("exact package lookup is not configured", {
      configuredOfferingKey: configuredOffering.key,
      targetOfferingId,
      productIdentifier,
    });
    return null;
  }

  return getPackageByProductId(
    offerings,
    targetOfferingId,
    productIdentifier
  );
};

const getMatchingEntitlement = (
  customerInfo: CustomerInfo
): PurchasesEntitlementInfo | null => {
  const exactMatch =
    customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID] ?? null;

  if (!exactMatch) {
    logRevenueCatWarn("expected entitlement is not active", {
      expectedEntitlementId: REVENUECAT_ENTITLEMENT_ID,
      activeEntitlementIds: Object.keys(customerInfo.entitlements.active),
    });
  }

  if (
    exactMatch?.productIdentifier &&
    !Object.values(REVENUECAT_PRODUCTS).includes(
      exactMatch.productIdentifier as
        (typeof REVENUECAT_PRODUCTS)[keyof typeof REVENUECAT_PRODUCTS]
    )
  ) {
    logRevenueCatWarn("expected entitlement product is not recognized", {
      expectedEntitlementId: REVENUECAT_ENTITLEMENT_ID,
      productIdentifier: exactMatch.productIdentifier,
      knownProductIdentifiers: Object.values(REVENUECAT_PRODUCTS),
    });
    return null;
  }

  return exactMatch;
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
    const currentAppUserId = await Purchases.getAppUserID().catch(() => null);

    logRevenueCatDebug("offerings fetch succeeded", {
      appUserId: redactValue(currentAppUserId),
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

    return null;
  }
}

async function getOtherScreensStandardOffering(appUserID?: string | null) {
  const offerings = await getRevenueCatOfferings(appUserID);
  return getOfferingById(
    offerings,
    REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD
  );
}

async function getSummerOfferPackage(appUserID?: string | null) {
  const offerings = await getRevenueCatOfferings(appUserID);
  return getPackageByProductId(
    offerings,
    REVENUECAT_OFFERINGS.SUMMER_OFFER,
    REVENUECAT_PRODUCTS.YEARLY_DISCOUNT
  );
}

async function getLifetimePackage(appUserID?: string | null) {
  const offerings = await getRevenueCatOfferings(appUserID);
  return getPackageByProductId(
    offerings,
    REVENUECAT_OFFERINGS.LIFETIME,
    REVENUECAT_PRODUCTS.LIFETIME
  );
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
  const resolvedOffering =
    offeringId && offerings ? offerings.all[offeringId] ?? null : null;
  const expectedProductIds: string[] =
    target === "exit"
      ? [REVENUECAT_PRODUCTS.YEARLY_DISCOUNT]
      : [
          REVENUECAT_PRODUCTS.YEARLY,
          REVENUECAT_PRODUCTS.WEEKLY,
        ];
  const hasExpectedProduct = Boolean(
    resolvedOffering?.availablePackages.some(rcPackage =>
      expectedProductIds.includes(rcPackage.product.identifier)
    )
  );
  const offering = hasExpectedProduct ? resolvedOffering : null;

  logRevenueCatDebug("hosted offering resolved", {
    target,
    placementKey,
    resolvedOfferingId: offeringId,
    foundOffering: Boolean(offering),
    expectedProductIds,
    offering: summarizeOffering(resolvedOffering),
    allOfferings: summarizeOfferings(offerings),
  });

  if (resolvedOffering && !hasExpectedProduct) {
    logRevenueCatWarn("hosted offering has no expected products", {
      resolvedOfferingId: offeringId,
      expectedProductIds,
      actualProductIds: resolvedOffering.availablePackages.map(
        rcPackage => rcPackage.product.identifier
      ),
    });
  }

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
    expectedEntitlementId: REVENUECAT_ENTITLEMENT_ID,
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
  const productIdentifier = getProductIdentifierForPlanKey(planKey);
  const packages = productIdentifier
    ? getPackagesAcrossAllOfferings(offerings).filter(
        rcPackage => rcPackage.product.identifier === productIdentifier
      )
    : [];

  logRevenueCatDebug("packages resolved for plan key", {
    planKey,
    productIdentifier,
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
      .flatMap<RevenueCatPaywallPlan>(configuredOffering => {
        const rcPackage = findRevenueCatPackage(
          offerings,
          configuredOffering,
          context
        );

        if (!rcPackage) {
          return [];
        }

        const planKey = getPlanKeyFromOfferingKey(configuredOffering.key);
        const resolvedOfferingId = getDedicatedRevenueCatOfferingId(
          configuredOffering,
          context
        );

        return [{
          id: configuredOffering.key,
          title: configuredOffering.title,
          durationLabel: rcPackage.product.priceString,
          price: formatPriceWithSuffix(
            rcPackage.product.priceString,
            getBillingSuffix(planKey)
          ),
          subtitle:
            configuredOffering.subtitle ||
            getPlanSubtitle(planKey, rcPackage),
          badge: configuredOffering.badge || undefined,
          highlight: getConfiguredOfferingHighlight(configuredOffering),
          planKey,
          revenueCatOfferingId:
            getRevenueCatOfferingIdFromPackage(rcPackage) ||
            resolvedOfferingId,
          revenueCatPackageId: rcPackage.identifier,
          rcPackage,
          introOffer: getIntroOffer(rcPackage),
        }];
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

function getRevenueCatPurchaseAttribution(
  customerInfo: CustomerInfo | null,
  offerings: PurchasesOfferings | null
): RevenueCatPurchaseAttribution | null {
  const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);
  const productIdentifier = activeEntitlement?.productIdentifier ?? null;
  const offeringKey = getRevenueCatOfferingKeyForProductIdentifier(
    productIdentifier
  );

  if (!activeEntitlement || !productIdentifier || !offeringKey) {
    logRevenueCatWarn("purchase attribution unavailable", {
      expectedEntitlementId: REVENUECAT_ENTITLEMENT_ID,
      activeProductIdentifier: productIdentifier,
      knownProductIdentifiers: Object.values(REVENUECAT_PRODUCTS),
    });
    return null;
  }

  const rcPackage = findRevenueCatPackageByProductIdentifier(
    offerings,
    productIdentifier
  );

  return {
    activeEntitlement,
    offeringKey,
    productIdentifier,
    revenueCatOfferingId:
      getRevenueCatOfferingIdFromPackage(rcPackage) ||
      getDefaultOfferingIdForOfferingKey(offeringKey),
    revenueCatPackageId: rcPackage?.identifier || productIdentifier,
    rcPackage,
  };
}

const getOfferingsSafe = getRevenueCatOfferings;
const purchasePackageSafe = purchaseRevenueCatPackage;
const restorePurchasesSafe = restoreRevenueCatPurchases;
const hasProEntitlement = hasRevenueCatPremiumAccess;

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
  getLifetimePackage,
  getOfferingsSafe,
  getOfferingById,
  getRevenueCatOfferingDetails,
  getRevenueCatOfferings,
  getOtherScreensStandardOffering,
  getPackageByProductId,
  getPackagesForOffering,
  getRevenueCatPurchaseAttribution,
  getRevenueCatOfferingKeyForProductIdentifier,
  getSummerOfferPackage,
  findRevenueCatPackageByProductIdentifier,
  getRevenueCatPackageMetadataForPlanKey,
  getRevenueCatPackagesForPlanKey,
  getRevenueCatPaywallPlans,
  hasPremiumAccess,
  hasProEntitlement,
  hasRevenueCatHostedPaywall,
  hasRevenueCatPremiumAccess,
  presentRevenueCatHostedPaywall,
  purchasePackageSafe,
  purchaseRevenueCatPackage,
  refreshRevenueCatEntitlementState,
  restoreRevenueCatPurchases,
  restorePurchasesSafe,
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
  RevenueCatPurchaseAttribution,
};
