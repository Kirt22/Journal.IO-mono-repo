export type FlowStage =
  | "onboarding"
  | "auth"
  | "sign-in"
  | "create-account"
  | "verify-email"
  | "profile"
  | "main-app"
  | "new-entry"
  | "journal-detail"
  | "journal-edit"
  | "complete";

export type AuthEntrySource = "email" | "google";
