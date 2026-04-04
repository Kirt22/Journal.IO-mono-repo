import AsyncStorage from "@react-native-async-storage/async-storage";

const INSTALL_SEEN_KEY = "journalio.installSeen";
const ONBOARDING_COMPLETED_KEY = "journalio.onboardingCompleted";

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

const clearOnboardingCompleted = async () => {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
};

export {
  clearOnboardingCompleted,
  getOnboardingCompleted,
  hasSeenInstall,
  markInstallSeen,
  saveOnboardingCompleted,
};
