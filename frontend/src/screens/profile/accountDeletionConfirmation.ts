import { Alert, Linking, Platform } from "react-native";

type ShowAccountDeletionConfirmationParams = {
  isPremiumUser: boolean;
  onConfirmDelete: () => void;
};

const APP_STORE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";

const getDeletionMessage = (isPremiumUser: boolean) => {
  const baseMessage =
    "This permanently deletes your Journal.IO account, journal entries, mood data, reminders, insights, and profile records. This action cannot be undone.";

  if (!isPremiumUser) {
    return baseMessage;
  }

  return `${baseMessage}\n\nDeleting your account does not cancel an active App Store subscription. You can manage or cancel subscriptions in your Apple account settings, or delete your account now.`;
};

const openSubscriptionSettings = async () => {
  if (Platform.OS !== "ios") {
    return;
  }

  await Linking.openURL(APP_STORE_SUBSCRIPTION_URL);
};

const showAccountDeletionConfirmation = ({
  isPremiumUser,
  onConfirmDelete,
}: ShowAccountDeletionConfirmationParams) => {
  const actions = [
    { text: "Cancel", style: "cancel" as const },
    ...(isPremiumUser
      ? [
          {
            text: "Manage Subscription",
            onPress: () => {
              openSubscriptionSettings().catch(() => {
                Alert.alert(
                  "Manage subscription",
                  "Open your App Store subscription settings manually if this link is unavailable on this device."
                );
              });
            },
          },
        ]
      : []),
    {
      text: "Delete Account",
      style: "destructive" as const,
      onPress: onConfirmDelete,
    },
  ];

  Alert.alert("Delete account?", getDeletionMessage(isPremiumUser), actions);
};

export { showAccountDeletionConfirmation };
