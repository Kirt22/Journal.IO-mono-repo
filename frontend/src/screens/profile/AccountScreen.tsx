import HapticPressable from '../../components/HapticPressable';
import {
  useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
  TextInput,
} from '../../infrastructure/reactNative';
import { Trash2 } from 'lucide-react-native';
import { deleteAccount } from '../../services/privacyService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import { ProfileSectionLayout, SectionCard } from './ProfileSectionLayout';
import {
  showAccountDeletionConfirmation,
  showFinalAccountDeletionConfirmation,
} from './accountDeletionConfirmation';

type AccountScreenProps = {
  onBack: () => void;
  onSignOut: () => Promise<void> | void;
};

function formatJoinedDate(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function AccountScreen({
  onBack,
  onSignOut,
}: AccountScreenProps) {
  const theme = useTheme();
  const sessionUser = useAppStore(state => state.session?.user ?? null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] =
    useState(false);
  const hasConfirmedDeletion =
    deleteConfirmation.trim().toUpperCase() === 'DELETE';
  const deletionDetails = sessionUser?.isPremium
    ? 'All journals and account data will be permanently deleted. Your App Store subscription will not be cancelled.\n\nThis action cannot be undone.'
    : 'All journals and account data will be permanently deleted.\n\nThis action cannot be undone.';

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);

    try {
      const result = await deleteAccount();

      if (!result.deletedAccount) {
        throw new Error('Unable to delete your account right now.');
      }

      await onSignOut();
    } catch (error) {
      Alert.alert(
        'Delete account',
        error instanceof Error
          ? error.message
          : 'Unable to delete your account right now.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const openDeleteConfirmation = () => {
    setDeleteConfirmation('');
    setIsDeleteConfirmationVisible(true);
  };

  const closeDeleteConfirmation = () => {
    if (isDeletingAccount) {
      return;
    }

    setIsDeleteConfirmationVisible(false);
    setDeleteConfirmation('');
  };

  const handleTypedConfirmation = () => {
    if (!hasConfirmedDeletion) {
      return;
    }

    closeDeleteConfirmation();
    showFinalAccountDeletionConfirmation(handleDeleteAccount);
  };

  return (
    <ProfileSectionLayout title="Manage account" onBack={onBack}>
      <SectionCard style={styles.detailsCard}>
        <View
          style={[
            styles.detailRow,
            styles.detailRowDivider,
            { borderBottomColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.label, { color: theme.colors.foreground }]}>
            Email
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.value, { color: theme.colors.mutedForeground }]}
          >
            {sessionUser?.email || 'Not provided'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.colors.foreground }]}>
            Joined
          </Text>
          <Text style={[styles.value, { color: theme.colors.mutedForeground }]}>
            {formatJoinedDate(sessionUser?.createdAt)}
          </Text>
        </View>
      </SectionCard>

      <View style={styles.actionSection}>
        <Text
          style={[styles.sectionLabel, { color: theme.colors.destructive }]}
        >
          Danger zone
        </Text>
        <HapticPressable
          accessibilityLabel="Delete account"
          accessibilityRole="button"
          disabled={isDeletingAccount}
          onPress={() =>
            showAccountDeletionConfirmation({
              isPremiumUser: Boolean(sessionUser?.isPremium),
              onConfirmDelete: handleDeleteAccount,
              onRequestTypedConfirmation: openDeleteConfirmation,
            })
          }
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.colors.card,
              borderColor: `${theme.colors.destructive}33`,
            },
            pressed && !isDeletingAccount && styles.pressed,
          ]}
        >
          <Trash2 size={17} color={theme.colors.destructive} />
          <Text
            style={[styles.actionText, { color: theme.colors.destructive }]}
          >
            {isDeletingAccount ? 'Deleting account...' : 'Delete account'}
          </Text>
        </HapticPressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeDeleteConfirmation}
        transparent
        visible={isDeleteConfirmationVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.dialogBackdrop}
        >
          <HapticPressable
            accessibilityLabel="Dismiss account deletion confirmation"
            disabled={isDeletingAccount}
            onPress={closeDeleteConfirmation}
            style={[
              styles.dialogScrim,
              { backgroundColor: `${theme.colors.foreground}66` },
            ]}
          />
          <View
            accessibilityViewIsModal
            style={[styles.dialog, { backgroundColor: theme.colors.card }]}
          >
            <View
              style={[
                styles.dialogHandle,
                { backgroundColor: theme.colors.border },
              ]}
            />
            <View
              style={[
                styles.dialogIcon,
                { backgroundColor: `${theme.colors.destructive}14` },
              ]}
            >
              <Trash2 size={20} color={theme.colors.destructive} />
            </View>
            <Text
              style={[styles.dialogTitle, { color: theme.colors.foreground }]}
            >
              Delete your account
            </Text>
            <Text
              style={[
                styles.dialogDescription,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {deletionDetails}
            </Text>
            <TextInput
              accessibilityLabel="Type DELETE to confirm"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeletingAccount}
              onChangeText={setDeleteConfirmation}
              placeholder="Type DELETE"
              placeholderTextColor={theme.colors.mutedForeground}
              style={[
                styles.confirmationInput,
                {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.foreground,
                },
              ]}
              value={deleteConfirmation}
            />
            <View style={styles.dialogActions}>
              <HapticPressable
                accessibilityLabel="Cancel account deletion"
                accessibilityRole="button"
                disabled={isDeletingAccount}
                onPress={closeDeleteConfirmation}
                style={({ pressed }) => [
                  styles.dialogButton,
                  {
                    backgroundColor: theme.colors.secondary,
                    borderColor: theme.colors.border,
                  },
                  pressed && !isDeletingAccount && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  Cancel
                </Text>
              </HapticPressable>
              <HapticPressable
                accessibilityLabel="Continue account deletion"
                accessibilityRole="button"
                disabled={!hasConfirmedDeletion || isDeletingAccount}
                onPress={handleTypedConfirmation}
                style={({ pressed }) => [
                  styles.dialogButton,
                  {
                    backgroundColor: theme.colors.destructive,
                    opacity:
                      hasConfirmedDeletion && !isDeletingAccount ? 1 : 0.45,
                  },
                  pressed && hasConfirmedDeletion && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: theme.colors.destructiveForeground },
                  ]}
                >
                  Continue
                </Text>
              </HapticPressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  detailsCard: {
    paddingVertical: 0,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    minHeight: 70,
    paddingHorizontal: 16,
  },
  detailRowDivider: {
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  value: {
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  actionSection: {
    gap: 10,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.76,
  },
  dialogBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dialogScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  dialog: {
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 28,
    width: '100%',
  },
  dialogHandle: {
    borderRadius: 999,
    height: 4,
    marginBottom: 22,
    width: 42,
  },
  dialogIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dialogTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  dialogDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  confirmationInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 12,
    width: '100%',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  dialogButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
