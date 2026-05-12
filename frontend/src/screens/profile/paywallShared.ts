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
      revenueCatOfferingId:
        plan.revenueCatOfferingId || configuredOffering?.revenueCatOfferingId || null,
      revenueCatPackageId:
        plan.revenueCatPackageId || configuredOffering?.revenueCatPackageId || null,
      rcPackage: plan.rcPackage,
      introOffer: plan.introOffer,
    };
  });

export const isPurchasesError = (error: unknown): error is PurchasesError =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  "message" in error;

const DEFAULT_PURCHASE_ERROR_MESSAGE =
  "We could not complete that purchase right now. No charge was made. Please try again.";

const TEST_STORE_PURCHASE_ERROR_MESSAGE =
  "The test purchase was declined. No charge was made. You can try again when you're ready.";

export const NO_RESTORED_PURCHASE_TITLE = "No purchases found";

export const NO_RESTORED_PURCHASE_MESSAGE =
  "We could not find an active premium purchase for this account.";

export const PURCHASE_UPDATING_SUCCESS_TITLE = "Purchase received";

export const PURCHASE_UPDATING_SUCCESS_MESSAGE =
  "Your purchase went through. We are still updating premium access on this account. If Premium does not appear in a moment, use Restore Purchases.";

const normalizeErrorMessage = (error: unknown) => {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message.toLowerCase() : "";
  }

  return "";
};

const getPurchaseErrorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;

const isTestStoreSimulatedPurchaseFailure = (error: unknown) => {
  const message = normalizeErrorMessage(error);

  return (
    getPurchaseErrorCode(error) ===
      PURCHASES_ERROR_CODE.TEST_STORE_SIMULATED_PURCHASE_ERROR ||
    message.includes("purchase failure simulated") ||
    message.includes("test purchase failure")
  );
};

export const getPurchaseErrorMessage = (error: unknown) => {
  if (isTestStoreSimulatedPurchaseFailure(error)) {
    return TEST_STORE_PURCHASE_ERROR_MESSAGE;
  }

  if (!isPurchasesError(error)) {
    const message = normalizeErrorMessage(error);

    if (message.includes("purchases are not available")) {
      return "Purchases are not available right now. Please try again a little later.";
    }

    return DEFAULT_PURCHASE_ERROR_MESSAGE;
  }

  if (
    error.code === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
    error.code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR
  ) {
    return "We could not reach purchases right now. Check your connection and try again.";
  }

  if (error.code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR) {
    return "This purchase option is not ready yet. Please try again in a moment.";
  }

  if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return "This payment is pending. Your access will update as soon as the store confirms it.";
  }

  if (error.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
    return "This purchase already appears to be active. Try restoring purchases to refresh access.";
  }

  if (error.code === PURCHASES_ERROR_CODE.OPERATION_ALREADY_IN_PROGRESS_ERROR) {
    return "A purchase is already in progress. Please wait a moment and try again.";
  }

  if (
    error.code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR ||
    error.code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR ||
    error.code === PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR ||
    error.code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  ) {
    return "The store could not complete that purchase. No charge was made. Please try again.";
  }

  return DEFAULT_PURCHASE_ERROR_MESSAGE;
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
