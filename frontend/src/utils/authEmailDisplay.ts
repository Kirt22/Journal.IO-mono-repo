const APPLE_PRIVATE_RELAY_DOMAIN = "privaterelay.appleid.com";

const isApplePrivateRelayEmail = (email?: string | null) => {
  return email?.trim().toLowerCase().endsWith(`@${APPLE_PRIVATE_RELAY_DOMAIN}`) ?? false;
};

const getAuthEmailDisplay = (
  email?: string | null,
  authSource?: "email" | "google" | "apple" | null
) => {
  if (authSource === "apple" && isApplePrivateRelayEmail(email)) {
    return "Apple private relay email";
  }

  return email || "";
};

export { getAuthEmailDisplay, isApplePrivateRelayEmail };
