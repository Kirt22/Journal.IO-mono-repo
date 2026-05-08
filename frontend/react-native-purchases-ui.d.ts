declare module "react-native-purchases-ui" {
  import type { PurchasesOffering } from "react-native-purchases";

  export const PAYWALL_RESULT: {
    readonly NOT_PRESENTED: "NOT_PRESENTED";
    readonly ERROR: "ERROR";
    readonly CANCELLED: "CANCELLED";
    readonly PURCHASED: "PURCHASED";
    readonly RESTORED: "RESTORED";
  };

  const RevenueCatUI: {
    presentPaywall: (options?: {
      offering?: PurchasesOffering;
    }) => Promise<
      | typeof PAYWALL_RESULT.NOT_PRESENTED
      | typeof PAYWALL_RESULT.ERROR
      | typeof PAYWALL_RESULT.CANCELLED
      | typeof PAYWALL_RESULT.PURCHASED
      | typeof PAYWALL_RESULT.RESTORED
    >;
  };

  export default RevenueCatUI;
}
