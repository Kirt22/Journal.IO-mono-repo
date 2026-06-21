export type FlowStage =
  | "onboarding"
  | "paywall"
  | "hosted-paywall"
  | "lifetime-offer"
  | "auth"
  | "sign-in"
  | "forgot-password"
  | "reset-password"
  | "create-account"
  | "verify-email"
  | "profile"
  | "main-app"
  | "new-entry"
  | "journal-detail"
  | "journal-edit"
  | "complete";

export type AuthEntrySource = "email" | "google" | "apple";
