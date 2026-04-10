import { request } from "../utils/apiClient";
import type { AuthUser } from "./authService";

type PaywallOfferingKey = "weekly" | "monthly" | "yearly" | "lifetime";
type PaywallTriggerMode = "contextual" | "interruptive";
type PaywallTemplateKey =
  | "weekly-standard"
  | "monthly-standard"
  | "yearly-commitment"
  | "lifetime-launch";

type PaywallFeatureCard = {
  title: string;
  body: string;
  footer: string | null;
};

type PaywallOffering = {
  key: PaywallOfferingKey;
  title: string;
  price: string;
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

const getPaywallConfig = async (params: GetPaywallConfigParams) => {
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

  const response = await request<ResolvedPaywallConfig>(
    `/paywall/config?${query}`,
    {
      method: "GET",
    }
  );

  return response.data;
};

const trackPaywallEvent = async (payload: PaywallEventPayload) => {
  const response = await request<{ eventId: string; createdAt: string }>(
    "/paywall/events",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return response.data;
};

const syncPaywallPurchase = async (payload: PaywallPurchaseSyncPayload) => {
  const response = await request<AuthUser>("/paywall/purchase-sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

export { getPaywallConfig, syncPaywallPurchase, trackPaywallEvent };
export type {
  GetPaywallConfigParams,
  PaywallEventPayload,
  PaywallFeatureCard,
  PaywallOffering,
  PaywallOfferingKey,
  PaywallPurchaseSyncPayload,
  PaywallTemplate,
  PaywallTriggerMode,
  ResolvedPaywallConfig,
};
