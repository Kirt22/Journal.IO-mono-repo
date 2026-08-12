type PremiumEntitlementSnapshot = {
  isPremium?: boolean | null;
  premiumPlanKey?: string | null;
  premiumExpiresAt?: Date | string | null;
  premiumSource?: string | null;
};

type DevelopmentPremiumAccessOverride = "auto" | "pro" | "free";

const TIME_LIMITED_PREMIUM_PLANS = new Set([
  "weekly",
  "monthly",
  "yearly",
]);

const getDevelopmentPremiumAccessOverride = (
  environment: NodeJS.ProcessEnv = process.env
): DevelopmentPremiumAccessOverride => {
  if (environment.NODE_ENV === "production") {
    return "auto";
  }

  const configuredOverride = environment.DEV_PREMIUM_ACCESS_OVERRIDE
    ?.trim()
    .toLowerCase();

  return configuredOverride === "pro" || configuredOverride === "free"
    ? configuredOverride
    : "auto";
};

const parsePremiumExpiration = (value?: Date | string | null) => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const hasActivePremiumEntitlement = (
  entitlement?: PremiumEntitlementSnapshot | null,
  now: Date = new Date(),
  environment: NodeJS.ProcessEnv = process.env
) => {
  if (!entitlement) {
    return false;
  }

  const developmentOverride =
    getDevelopmentPremiumAccessOverride(environment);

  if (developmentOverride !== "auto") {
    return developmentOverride === "pro";
  }

  if (
    !entitlement.isPremium ||
    entitlement.premiumSource !== "revenuecat_verified"
  ) {
    return false;
  }

  if (entitlement.premiumPlanKey === "lifetime") {
    return true;
  }

  if (!TIME_LIMITED_PREMIUM_PLANS.has(entitlement.premiumPlanKey || "")) {
    return false;
  }

  const expiresAt = parsePremiumExpiration(entitlement.premiumExpiresAt);
  return Boolean(expiresAt && expiresAt.getTime() > now.getTime());
};

export {
  getDevelopmentPremiumAccessOverride,
  hasActivePremiumEntitlement,
};
export type {
  DevelopmentPremiumAccessOverride,
  PremiumEntitlementSnapshot,
};
