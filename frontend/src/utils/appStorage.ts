import AsyncStorage from "@react-native-async-storage/async-storage";

const INSTALL_SEEN_KEY = "journalio.installSeen";
const ONBOARDING_COMPLETED_KEY = "journalio.onboardingCompleted";
const HIDE_JOURNAL_PREVIEWS_KEY = "journalio.hideJournalPreviews";
const POST_AUTH_PAYWALL_SEEN_KEY = "journalio.postAuthPaywallSeen";

const hasSeenInstall = async () => {
  return (await AsyncStorage.getItem(INSTALL_SEEN_KEY)) === "true";
};

const markInstallSeen = async () => {
  await AsyncStorage.setItem(INSTALL_SEEN_KEY, "true");
};

const getOnboardingCompleted = async () => {
  return (await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)) === "true";
};

const saveOnboardingCompleted = async (completed: boolean) => {
  await AsyncStorage.setItem(
    ONBOARDING_COMPLETED_KEY,
    completed ? "true" : "false"
  );
};

const getPostAuthPaywallSeen = async () => {
  const value = await AsyncStorage.getItem(POST_AUTH_PAYWALL_SEEN_KEY);

  if (value === null) {
    return null;
  }

  return value === "true";
};

const savePostAuthPaywallSeen = async (seen: boolean) => {
  await AsyncStorage.setItem(
    POST_AUTH_PAYWALL_SEEN_KEY,
    seen ? "true" : "false"
  );
};

const getHideJournalPreviews = async () => {
  return (await AsyncStorage.getItem(HIDE_JOURNAL_PREVIEWS_KEY)) === "true";
};

const saveHideJournalPreviews = async (enabled: boolean) => {
  await AsyncStorage.setItem(
    HIDE_JOURNAL_PREVIEWS_KEY,
    enabled ? "true" : "false"
  );
};

const clearOnboardingCompleted = async () => {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
};

const clearPostAuthPaywallSeen = async () => {
  await AsyncStorage.removeItem(POST_AUTH_PAYWALL_SEEN_KEY);
};

export {
  clearOnboardingCompleted,
  clearPostAuthPaywallSeen,
  getHideJournalPreviews,
  getOnboardingCompleted,
  getPostAuthPaywallSeen,
  hasSeenInstall,
  markInstallSeen,
  saveHideJournalPreviews,
  saveOnboardingCompleted,
  savePostAuthPaywallSeen,
};
