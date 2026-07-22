type PremiumEntitlementSnapshot = {
  isPremium?: boolean | null;
  premiumPlanKey?: string | null;
  premiumExpiresAt?: Date | string | null;
  premiumSource?: string | null;
};

const TIME_LIMITED_PREMIUM_PLANS = new Set([
  "weekly",
  "monthly",
  "yearly",
]);

const parsePremiumExpiration = (value?: Date | string | null) => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const hasActivePremiumEntitlement = (
  entitlement?: PremiumEntitlementSnapshot | null,
  now: Date = new Date()
) => {
  if (
    !entitlement?.isPremium ||
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

export { hasActivePremiumEntitlement };
export type { PremiumEntitlementSnapshot };
