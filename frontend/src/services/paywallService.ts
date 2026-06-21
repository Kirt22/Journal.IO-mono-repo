import { ApiError, request } from "../utils/apiClient";
import type { AuthUser } from "./authService";

type PaywallOfferingKey =
  | "weekly"
  | "monthly"
  | "yearly"
  | "yearly_exit_offer"
  | "lifetime";
type PaywallTriggerMode = "contextual" | "interruptive";
type PaywallTemplateKey =
  | "weekly-standard"
  | "monthly-standard"
  | "yearly-commitment"
  | "post-auth-trial"
  | "post-auth-exit-offer"
  | "lifetime-launch";

type PaywallFeatureCard = {
  title: string;
  body: string;
  footer: string | null;
};

type PaywallOffering = {
  key: PaywallOfferingKey;
  title: string;
  price: string | null;
  priceSuffix: string | null;
  subtitle: string | null;
  badge: string | null;
  highlight: string | null;
  sortOrder: number;
  revenueCatOfferingId: string | null;
  revenueCatPackageId: string | null;
  purchasedUsersCount: number;
  purchaseLimit: number | null;
};

type PaywallTemplate = {
  key: PaywallTemplateKey;
  title: string;
  headline: string;
  subheadline: string | null;
  heroBadgeLabel: string | null;
  purchaseChipTitle: string | null;
  purchaseChipBody: string | null;
  featureCarouselTitle: string | null;
  socialProofLine: string | null;
  footerLegal: string | null;
  featureList: PaywallFeatureCard[];
  primaryOfferingKey: PaywallOfferingKey;
  secondaryOfferingKeys: PaywallOfferingKey[];
  visibleOfferingKeys: PaywallOfferingKey[];
};

type ResolvedPaywallConfig = {
  shouldShow: boolean;
  placementKey: string;
  screenKey: string | null;
  triggerMode: PaywallTriggerMode;
  wasInterruptive: boolean;
  reason: string;
  template: PaywallTemplate | null;
  offerings: PaywallOffering[];
};

type GetPaywallConfigParams = {
  placementKey: string;
  screenKey?: string;
  currentStage?: string;
  triggerMode?: PaywallTriggerMode;
};

type PaywallEventPayload = {
  placementKey: string;
  screenKey?: string;
  eventType:
    | "locked_feature_tap"
    | "upgrade_tap"
    | "paywall_impression"
    | "paywall_dismiss"
    | "plan_select"
    | "cta_tap"
    | "purchase_success"
    | "restore_success"
    | "purchase_failure";
  templateKey?: string;
  offeringKey?: PaywallOfferingKey;
  wasInterruptive?: boolean;
  metadata?: Record<string, unknown>;
};

type PaywallPurchaseSyncPayload = {
  offeringKey: PaywallOfferingKey;
  revenueCatOfferingId: string;
  revenueCatPackageId: string;
  store: string;
  entitlementId: string;
  wasRestore?: boolean;
};

type PaywallEntitlementSyncPayload = {
  reason?: string;
};

const PAYWALL_DEBUG_PREFIX = "[PaywallDebug]";

const shouldLogPaywallDebug = () => __DEV__;

const logPaywallDebug = (event: string, data?: Record<string, unknown>) => {
  if (!shouldLogPaywallDebug()) {
    return;
  }

  console.info(`${PAYWALL_DEBUG_PREFIX} ${event}`, data ?? {});
};

const logPaywallWarn = (event: string, data?: Record<string, unknown>) => {
  if (!shouldLogPaywallDebug()) {
    return;
  }

  console.warn(`${PAYWALL_DEBUG_PREFIX} ${event}`, data ?? {});
};

const summarizePaywallConfig = (config: ResolvedPaywallConfig | null) => {
  if (!config) {
    return null;
  }

  return {
    shouldShow: config.shouldShow,
    placementKey: config.placementKey,
    screenKey: config.screenKey,
    triggerMode: config.triggerMode,
    wasInterruptive: config.wasInterruptive,
    reason: config.reason,
    templateKey: config.template?.key ?? null,
    visibleOfferingKeys: config.template?.visibleOfferingKeys ?? [],
    primaryOfferingKey: config.template?.primaryOfferingKey ?? null,
    offerings: config.offerings.map(offering => ({
      key: offering.key,
      title: offering.title,
      price: offering.price,
      priceSuffix: offering.priceSuffix,
      revenueCatOfferingId: offering.revenueCatOfferingId,
      revenueCatPackageId: offering.revenueCatPackageId,
      sortOrder: offering.sortOrder,
    })),
  };
};

const summarizePaywallError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };

const getPaywallConfig = async (params: GetPaywallConfigParams) => {
  logPaywallDebug("config fetch requested", params);

  const queryEntries = [{ key: "placementKey", value: params.placementKey }];

  if (params.screenKey) {
    queryEntries.push({ key: "screenKey", value: params.screenKey });
  }

  if (params.currentStage) {
    queryEntries.push({ key: "currentStage", value: params.currentStage });
  }

  if (params.triggerMode) {
    queryEntries.push({ key: "triggerMode", value: params.triggerMode });
  }

  const query = queryEntries
    .map(
      entry =>
        `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`
    )
    .join("&");

  try {
    const response = await request<ResolvedPaywallConfig>(
      `/paywall/config?${query}`,
      {
        method: "GET",
      }
    );

    logPaywallDebug("config fetch succeeded", {
      requestPath: `/paywall/config?${query}`,
      config: summarizePaywallConfig(response.data),
    });

    return response.data;
  } catch (error) {
    logPaywallWarn("config fetch failed", {
      requestPath: `/paywall/config?${query}`,
      error: summarizePaywallError(error),
    });

    throw error;
  }
};

const trackPaywallEvent = async (payload: PaywallEventPayload) => {
  logPaywallDebug("event track requested", {
    placementKey: payload.placementKey,
    screenKey: payload.screenKey,
    eventType: payload.eventType,
    templateKey: payload.templateKey,
    offeringKey: payload.offeringKey,
    wasInterruptive: payload.wasInterruptive,
    metadata: payload.metadata,
  });

  const response = await request<{ eventId: string; createdAt: string }>(
    "/paywall/events",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  logPaywallDebug("event track succeeded", response.data);

  return response.data;
};

const syncPaywallPurchase = async (payload: PaywallPurchaseSyncPayload) => {
  logPaywallDebug("purchase sync requested", payload);

  const response = await request<AuthUser>("/paywall/purchase-sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  logPaywallDebug("purchase sync succeeded", {
    userId: response.data.userId,
    isPremium: response.data.isPremium,
    premiumPlanKey: response.data.premiumPlanKey,
    premiumActivatedAt: response.data.premiumActivatedAt,
  });

  return response.data;
};

const syncPaywallEntitlement = async (
  payload: PaywallEntitlementSyncPayload = {}
) => {
  logPaywallDebug("entitlement sync requested", payload);

  const response = await request<AuthUser>("/paywall/entitlement-sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  logPaywallDebug("entitlement sync succeeded", {
    userId: response.data.userId,
    isPremium: response.data.isPremium,
    premiumPlanKey: response.data.premiumPlanKey,
    premiumExpiresAt: response.data.premiumExpiresAt,
    premiumWillRenew: response.data.premiumWillRenew,
  });

  return response.data;
};

const isRetryableEntitlementSyncError = (error: unknown) =>
  error instanceof ApiError &&
  (error.isNetworkError || error.status === 502 || error.status === 503);

export {
  getPaywallConfig,
  isRetryableEntitlementSyncError,
  syncPaywallEntitlement,
  syncPaywallPurchase,
  trackPaywallEvent,
};
export type {
  GetPaywallConfigParams,
  PaywallEntitlementSyncPayload,
  PaywallEventPayload,
  PaywallFeatureCard,
  PaywallOffering,
  PaywallOfferingKey,
  PaywallPurchaseSyncPayload,
  PaywallTemplate,
  PaywallTriggerMode,
  ResolvedPaywallConfig,
};
