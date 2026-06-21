export const REVENUECAT_ENTITLEMENT_ID = "Journal.IO Pro";

export const REVENUECAT_PRODUCT_IDS = {
  weekly: "app.journalio.premium.weekly",
  yearly: "app.journalio.premium.yearly",
  yearlyExitOffer: "app.journalio.premium.yearly.exit",
  lifetime: "app.journalio.premium.lifetime",
} as const;

export type RevenueCatPlanKey = "weekly" | "yearly" | "lifetime";

const normalizeEnvValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
};

const splitEnvList = (value?: string | null) =>
  normalizeEnvValue(value)
    .split(",")
    .map(item => item.trim().toUpperCase())
    .filter(Boolean);

const KNOWN_PRODUCT_IDS = new Set<string>([
  REVENUECAT_PRODUCT_IDS.weekly,
  REVENUECAT_PRODUCT_IDS.yearly,
  REVENUECAT_PRODUCT_IDS.yearlyExitOffer,
  REVENUECAT_PRODUCT_IDS.lifetime,
]);

const getRevenueCatWebhookAuthToken = () =>
  normalizeEnvValue(process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN);

const getRevenueCatSecretApiKey = () =>
  normalizeEnvValue(process.env.REVENUECAT_SECRET_API_KEY);

const getRevenueCatAppId = () => normalizeEnvValue(process.env.REVENUECAT_APP_ID);

const getRevenueCatAllowedWebhookEnvironments = () => {
  const configuredEnvironments = splitEnvList(
    process.env.REVENUECAT_ALLOWED_WEBHOOK_ENVIRONMENTS
  );

  if (configuredEnvironments.length > 0) {
    return new Set(configuredEnvironments);
  }

  return new Set(["PRODUCTION", "SANDBOX"]);
};

const assertRevenueCatProductionConfiguration = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missingVariables = [
    ["REVENUECAT_WEBHOOK_AUTH_TOKEN", getRevenueCatWebhookAuthToken()],
    ["REVENUECAT_SECRET_API_KEY", getRevenueCatSecretApiKey()],
    ["REVENUECAT_APP_ID", getRevenueCatAppId()],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required RevenueCat production environment variables: ${missingVariables.join(
        ", "
      )}`
    );
  }
};

const isKnownRevenueCatProductId = (productId?: string | null) =>
  Boolean(productId && KNOWN_PRODUCT_IDS.has(productId));

const getRevenueCatPlanKeyForProductId = (
  productId?: string | null
): RevenueCatPlanKey | null => {
  switch (productId) {
    case REVENUECAT_PRODUCT_IDS.weekly:
      return "weekly";
    case REVENUECAT_PRODUCT_IDS.yearly:
    case REVENUECAT_PRODUCT_IDS.yearlyExitOffer:
      return "yearly";
    case REVENUECAT_PRODUCT_IDS.lifetime:
      return "lifetime";
    default:
      return null;
  }
};

const isRevenueCatLifetimeProductId = (productId?: string | null) =>
  productId === REVENUECAT_PRODUCT_IDS.lifetime;

export {
  assertRevenueCatProductionConfiguration,
  getRevenueCatAllowedWebhookEnvironments,
  getRevenueCatAppId,
  getRevenueCatPlanKeyForProductId,
  getRevenueCatSecretApiKey,
  getRevenueCatWebhookAuthToken,
  isKnownRevenueCatProductId,
  isRevenueCatLifetimeProductId,
};
