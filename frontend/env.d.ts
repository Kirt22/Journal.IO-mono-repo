declare module "@env" {
  export const API_BASE_URL: string | undefined;
  export const FRONTEND_ENV: string | undefined;
  export const GOOGLE_WEB_CLIENT_ID: string | undefined;
  export const GOOGLE_IOS_CLIENT_ID: string | undefined;
  export const REVENUECAT_IOS_API_KEY: string | undefined;
  export const REVENUECAT_ANDROID_API_KEY: string | undefined;
  export const IOS_APP_STORE_ID: string | undefined;
  export const ANDROID_PLAY_STORE_PACKAGE_NAME: string | undefined;
  // Dev-only paywall layout preview. See src/services/devPriceOverride.ts.
  export const DEV_PRICE_STOREFRONT: string | undefined;
}
