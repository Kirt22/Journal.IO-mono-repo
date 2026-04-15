import {
  PURCHASES_ERROR_CODE,
  type PurchasesError,
} from "react-native-purchases";
import type {
  RevenueCatIntroOffer,
  RevenueCatPaywallPlan,
} from "../../services/revenueCatService";
import type {
  PaywallFeatureCard,
  PaywallOffering,
  ResolvedPaywallConfig,
} from "../../services/paywallService";

export type PaywallPlan = {
  id: string;
  durationLabel: string;
  title: string;
  price: string;
  subtitle: string;
  planKey: RevenueCatPaywallPlan["planKey"];
  highlight?: string;
  badge?: string;
  offeringKey?: PaywallOffering["key"];
  revenueCatOfferingId?: string | null;
  revenueCatPackageId?: string | null;
  rcPackage?: RevenueCatPaywallPlan["rcPackage"];
  introOffer?: RevenueCatIntroOffer | null;
};

export const fallbackFeatureCards: PaywallFeatureCard[] = [
  {
    title: "Reflect with clearer weekly reads",
    body: "Journal.IO turns recent entries into calmer pattern summaries that are easier to scan over time.",
    footer: "A premium layer designed to support the habit, not interrupt it.",
  },
  {
    title: "Keep AI help close to the writing flow",
    body: "Unlock premium prompts, tag suggestions, and quick analysis when you want more structure from a saved entry.",
    footer: "Short support in the moments you actually use it.",
  },
  {
    title: "Open the locked insight surfaces",
    body: "Premium keeps the Home AI card, deeper Insights analysis, and privacy controls available across the app.",
    footer: "A steadier version of Journal.IO for longer-term journaling.",
  },
];

export const buildFeatureCards = (
  paywallConfig: ResolvedPaywallConfig | null
) =>
  paywallConfig?.template?.featureList?.length
    ? paywallConfig.template.featureList
    : fallbackFeatureCards;

export const buildPaywallPlans = (
  livePlans: RevenueCatPaywallPlan[],
  resolvedConfig: ResolvedPaywallConfig | null
): PaywallPlan[] =>
  livePlans.map(plan => {
    const configuredOffering = resolvedConfig?.offerings.find(
      offering => offering.key === plan.id
    );

    return {
      id: plan.id,
      durationLabel: plan.durationLabel,
      title: plan.title,
      price: plan.price,
      subtitle: plan.subtitle,
      planKey: plan.planKey,
      highlight: plan.highlight,
      badge: plan.badge,
      offeringKey: configuredOffering?.key,
      revenueCatOfferingId: configuredOffering?.revenueCatOfferingId || null,
      revenueCatPackageId: configuredOffering?.revenueCatPackageId || null,
      rcPackage: plan.rcPackage,
      introOffer: plan.introOffer,
    };
  });

export const isPurchasesError = (error: unknown): error is PurchasesError =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  "message" in error;

export const getPurchaseErrorMessage = (error: unknown) => {
  if (!isPurchasesError(error)) {
    return error instanceof Error
      ? error.message
      : "We could not complete that purchase right now. Please try again.";
  }

  if (
    error.code === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
    error.code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR
  ) {
    return "The purchase could not reach RevenueCat right now. Check your connection and try again.";
  }

  if (error.code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR) {
    return "RevenueCat is configured, but the selected package is not ready yet.";
  }

  if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return "This payment is pending. RevenueCat will update the entitlement when the store confirms it.";
  }

  return error.message;
};

export const getTrialFootnote = (
  plan: PaywallPlan | undefined,
  introOffer?: RevenueCatIntroOffer | null
) => {
  if (!plan || !introOffer) {
    return null;
  }

  const introSummary = introOffer.isFreeTrial
    ? `${introOffer.durationLabel} free`
    : `${introOffer.price} intro for ${introOffer.durationLabel}`;

  return `If eligible, ${introSummary}, then ${plan.price}. Apple confirms final introductory terms before purchase.`;
};

export const getIntroOfferLabel = (introOffer?: RevenueCatIntroOffer | null) => {
  if (!introOffer) {
    return null;
  }

  if (introOffer.isFreeTrial) {
    return `${introOffer.durationLabel.toUpperCase()} FREE`;
  }

  return `${introOffer.durationLabel.toUpperCase()} INTRO`;
};
