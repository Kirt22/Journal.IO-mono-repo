const REVENUECAT_ENTITLEMENT_ID = "Journal.IO Pro";

const REVENUECAT_PRODUCTS = {
  WEEKLY: "app.journalio.premium.weekly",
  YEARLY: "app.journalio.premium.yearly",
  YEARLY_DISCOUNT: "app.journalio.premium.yearly.exit",
  LIFETIME: "app.journalio.premium.lifetime",
} as const;

const REVENUECAT_OFFERINGS = {
  OTHER_SCREENS_STANDARD: "journalio_offering_other_screens_standard",
  SUMMER_OFFER: "journalio_offering_post_onboarding_exit",
  LIFETIME: "journalio_offering_lifetime",
} as const;

const REVENUECAT_SUMMER_PAYWALL_VARIABLES = {
  NORMAL_YEARLY_PRICE: "normal_yearly_price",
} as const;

export {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERINGS,
  REVENUECAT_PRODUCTS,
  REVENUECAT_SUMMER_PAYWALL_VARIABLES,
};
