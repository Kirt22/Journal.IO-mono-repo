declare module "react-native-purchases-ui" {
  import type { ComponentType } from "react";
  import type {
    CustomerInfo,
    PurchasesOffering,
    PurchasesPackage,
  } from "react-native-purchases";

  export type CustomVariable =
    | { type: "string"; value: string }
    | { type: "number"; value: number }
    | { type: "boolean"; value: boolean };

  export type CustomVariables = Record<string, CustomVariable>;

  export const CustomVariableValue: {
    string: (value: string) => CustomVariable;
    number: (value: number) => CustomVariable;
    boolean: (value: boolean) => CustomVariable;
  };

  export const PAYWALL_RESULT: {
    readonly NOT_PRESENTED: "NOT_PRESENTED";
    readonly ERROR: "ERROR";
    readonly CANCELLED: "CANCELLED";
    readonly PURCHASED: "PURCHASED";
    readonly RESTORED: "RESTORED";
  };

  const RevenueCatUI: {
    Paywall: ComponentType<{
      style?: unknown;
      options?: {
        offering?: PurchasesOffering | null;
        displayCloseButton?: boolean;
        customVariables?: CustomVariables;
      };
      onPurchaseStarted?: (payload: {
        packageBeingPurchased: PurchasesPackage;
      }) => void;
      onPurchaseCompleted?: (payload: {
        customerInfo: CustomerInfo;
        storeTransaction: unknown;
      }) => void;
      onPurchaseCancelled?: () => void;
      onPurchaseError?: (payload: { error: unknown }) => void;
      onRestoreStarted?: () => void;
      onRestoreCompleted?: (payload: { customerInfo: CustomerInfo }) => void;
      onRestoreError?: (payload: { error: unknown }) => void;
      onDismiss?: () => void;
    }>;
    presentPaywall: (options?: {
      offering?: PurchasesOffering;
      customVariables?: CustomVariables;
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
