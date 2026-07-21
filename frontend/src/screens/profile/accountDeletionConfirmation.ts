import { Alert, Platform } from 'react-native';

type ShowAccountDeletionConfirmationParams = {
  isPremiumUser: boolean;
  onConfirmDelete: () => void;
  onRequestTypedConfirmation: () => void;
};

const getDeletionMessage = (isPremiumUser: boolean) => {
  const subscriptionMessage = isPremiumUser
    ? '\n\nYour App Store subscription will not be cancelled.'
    : '';

  return `All journals and account data will be permanently deleted.${subscriptionMessage}\n\nThis action cannot be undone.\n\nType DELETE to continue.`;
};

const showFinalAccountDeletionConfirmation = (onConfirmDelete: () => void) => {
  Alert.alert('Are you sure?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete Account',
      style: 'destructive',
      onPress: onConfirmDelete,
    },
  ]);
};

const showAccountDeletionConfirmation = ({
  isPremiumUser,
  onConfirmDelete,
  onRequestTypedConfirmation,
}: ShowAccountDeletionConfirmationParams) => {
  if (Platform.OS !== 'ios') {
    onRequestTypedConfirmation();
    return;
  }

  const showTypedPrompt = () => {
    Alert.prompt(
      'Delete account?',
      getDeletionMessage(isPremiumUser),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: (value?: string) => {
            if (value?.trim().toUpperCase() === 'DELETE') {
              showFinalAccountDeletionConfirmation(onConfirmDelete);
              return;
            }

            Alert.alert(
              'Type DELETE to continue',
              'Enter DELETE exactly to confirm account deletion.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Try again', onPress: showTypedPrompt },
              ],
            );
          },
        },
      ],
      'plain-text',
    );
  };

  showTypedPrompt();
};

export {
  showAccountDeletionConfirmation,
  showFinalAccountDeletionConfirmation,
};
