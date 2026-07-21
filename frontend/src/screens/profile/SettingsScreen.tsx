import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  ChevronRight,
  Crown,
  Lock,
  LogOut,
} from 'lucide-react-native';
import { getPrimaryDailyReminder } from '../../services/remindersService';
import { getReminderPermissionGranted } from '../../services/reminderNotificationsService';
import { trackPaywallEvent } from '../../services/paywallService';
import { getBiometricLockLabel } from '../../services/biometricLockService';
import { updateAiOptOutPreference } from '../../services/privacyService';
import { triggerHaptic } from '../../services/hapticsService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import {
  LEGAL_URLS,
  openDeviceBrowserUrl,
  openExternalUrl,
} from '../../utils/legalLinks';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import {
  getPersonalizationThemeSummary,
  type PersonalizationThemePreference,
} from './personalizationThemes';
import type { ThemePreference } from '../../theme/theme';

const SETTINGS_ICONS = {
  aboutMe: require('../../assets/png/settings/icons8-about-me-48.png'),
  account: require('../../assets/png/settings/icons8-account-48.png'),
  aiAnalysis: require('../../assets/png/settings/icons8-ai-48.png'),
  biometricLock: require('../../assets/png/settings/icons8-biometric-lock-64.png'),
  credits: require('../../assets/png/settings/icons8-giving-48.png'),
  exportData: require('../../assets/png/settings/icons8-export-64.png'),
  haptics: require('../../assets/png/settings/icons8-phone-vibration-28.png'),
  hideEntries: require('../../assets/png/settings/icons8-hide-67.png'),
  notifications: require('../../assets/png/settings/icons8-notification-64.png'),
  privacyChoices: require('../../assets/png/settings/icons8-privacy-64.png'),
  privacyPolicy: require('../../assets/png/settings/icons8-privacy-policy-64.png'),
  support: require('../../assets/png/settings/icons8-support-100.png'),
  termsOfService: require('../../assets/png/settings/icons8-terms-and-conditions-64.png'),
  theme: require('../../assets/png/settings/icons8-theme-48.png'),
} as const;

type SettingsScreenProps = {
  onBack: () => void;
  onOpenAboutYou?: () => void;
  onOpenManageAccount?: () => void;
  onOpenNotifications?: () => void;
  onOpenPrivacy: () => void;
  onOpenPrivacyModePaywall: () => void;
  onOpenHidePreviewsPaywall: () => void;
  onOpenBiometricLock: () => void;
  onOpenSubscription?: () => void;
  onOpenTheme?: () => void;
  onSignOut: () => Promise<void> | void;
  currentThemePreference: PersonalizationThemePreference;
  onToggleTheme?: (nextTheme: ThemePreference | null) => void;
};

type SettingsListRowProps = {
  accessibilityLabel?: string;
  description: string;
  disabled?: boolean;
  icon: ImageSourcePropType | typeof Crown;
  label: string;
  onPress?: () => void;
  right?: ReactNode;
  showChevron?: boolean;
};

export type SettingsPersonalizationSectionProps = {
  currentThemePreference: PersonalizationThemePreference;
  onOpenAboutYou: () => void;
  onOpenNotifications: () => void;
  onOpenTheme: () => void;
};

export type SettingsAccountSectionProps = {
  onOpenManageAccount: () => void;
  onOpenSubscription: () => void;
};

export type SettingsPrivacyDataSectionProps = {
  onOpenExport: () => void;
  onOpenHidePreviewsPaywall: () => void;
  onOpenBiometricLock: () => void;
  onOpenPrivacyModePaywall: () => void;
};

function SettingsListRow({
  accessibilityLabel,
  description,
  disabled = false,
  icon,
  label,
  onPress,
  right,
  showChevron = true,
}: SettingsListRowProps) {
  const theme = useTheme();
  const LucideIcon = typeof icon === 'function' ? icon : null;

  const content = (
    <>
      <View
        style={[
          styles.personalizationIcon,
          { backgroundColor: theme.colors.accent },
        ]}
      >
        {LucideIcon ? (
          <LucideIcon size={19} color={theme.colors.primary} />
        ) : (
          <Image
            resizeMode="contain"
            source={icon as ImageSourcePropType}
            style={styles.rowIcon}
          />
        )}
      </View>
      <View style={styles.personalizationCopy}>
        <Text
          style={[
            styles.personalizationLabel,
            { color: theme.colors.foreground },
          ]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.personalizationDescription,
            { color: theme.colors.mutedForeground },
          ]}
        >
          {description}
        </Text>
      </View>
      {right}
      {showChevron ? (
        <ChevronRight size={19} color={theme.colors.mutedForeground} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessibilityState={disabled ? { disabled: true } : undefined}
        style={[styles.personalizationRow, disabled && styles.rowDisabled]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.personalizationRow,
        disabled && styles.rowDisabled,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

type SettingsToggleProps = {
  accessibilityLabel?: string;
  disabled: boolean;
  onValueChange: (nextValue: boolean) => void | Promise<void>;
  value: boolean;
};

function SettingsToggle({
  accessibilityLabel,
  disabled,
  onValueChange,
  value,
}: SettingsToggleProps) {
  const theme = useTheme();

  return (
    <View style={styles.toggleSlot}>
      <Switch
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onValueChange={onValueChange}
        style={styles.toggleControl}
        thumbColor={theme.colors.card}
        trackColor={{
          false: theme.colors.border,
          true: theme.colors.primary,
        }}
        value={value}
      />
    </View>
  );
}

export function SettingsAccountSection({
  onOpenManageAccount,
  onOpenSubscription,
}: SettingsAccountSectionProps) {
  const theme = useTheme();
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );

  return (
    <View style={styles.personalizationSection}>
      <Text
        style={[styles.sectionEyebrow, { color: theme.colors.mutedForeground }]}
      >
        Account
      </Text>
      <View
        style={[
          styles.personalizationList,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <SettingsListRow
          accessibilityLabel="Open manage account"
          description="Email, account and deletion"
          icon={SETTINGS_ICONS.account}
          label="Manage account"
          onPress={onOpenManageAccount}
        />
        {isPremiumUser ? (
          <SettingsListRow
            accessibilityLabel="Open subscription"
            description="Plan and billing details"
            icon={Crown}
            label="Subscription"
            onPress={onOpenSubscription}
          />
        ) : null}
      </View>
    </View>
  );
}

export function SettingsPersonalizationSection({
  currentThemePreference,
  onOpenAboutYou,
  onOpenNotifications,
  onOpenTheme,
}: SettingsPersonalizationSectionProps) {
  const theme = useTheme();
  const userName = useAppStore(
    state => state.session?.user.name || 'Your profile',
  );
  const [notificationStatus, setNotificationStatus] = useState<
    'checking' | 'off' | 'on'
  >('checking');

  useEffect(() => {
    let isMounted = true;

    Promise.all([getPrimaryDailyReminder(), getReminderPermissionGranted()])
      .then(([reminder, hasPermission]) => {
        if (isMounted) {
          setNotificationStatus(
            reminder?.enabled && hasPermission ? 'on' : 'off',
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setNotificationStatus('off');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const themeSummary = getPersonalizationThemeSummary(
    currentThemePreference,
    theme.colors.primary,
  );

  return (
    <View style={styles.personalizationSection}>
      <Text
        style={[styles.sectionEyebrow, { color: theme.colors.mutedForeground }]}
      >
        Personalisation
      </Text>
      <View
        style={[
          styles.personalizationList,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <SettingsListRow
          description={userName}
          icon={SETTINGS_ICONS.aboutMe}
          label="About me"
          onPress={onOpenAboutYou}
        />
        <SettingsListRow
          description={themeSummary.description}
          icon={SETTINGS_ICONS.theme}
          label="Theme"
          onPress={onOpenTheme}
          right={
            <View style={styles.themeValue}>
              <View
                style={[
                  styles.themeDot,
                  { backgroundColor: themeSummary.color },
                ]}
              />
              <Text
                style={[
                  styles.valueText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {themeSummary.label}
              </Text>
            </View>
          }
        />
        <SettingsListRow
          description={
            notificationStatus === 'checking'
              ? 'Checking device settings'
              : notificationStatus === 'on'
              ? 'Daily reminders are enabled'
              : 'Daily reminders are off'
          }
          icon={SETTINGS_ICONS.notifications}
          label="Notifications"
          onPress={onOpenNotifications}
          right={
            <Text
              style={[
                styles.valueText,
                {
                  color:
                    notificationStatus === 'on'
                      ? theme.colors.primary
                      : theme.colors.mutedForeground,
                },
              ]}
            >
              {notificationStatus === 'checking'
                ? '...'
                : notificationStatus === 'on'
                ? 'On'
                : 'Off'}
            </Text>
          }
        />
      </View>
    </View>
  );
}

export function SettingsMoreSection() {
  const theme = useTheme();
  const hapticsEnabled = useAppStore(state => state.hapticsEnabled);
  const setHapticsEnabled = useAppStore(state => state.setHapticsEnabled);
  const [isUpdatingHaptics, setIsUpdatingHaptics] = useState(false);

  const handleHapticsChange = async (nextValue: boolean) => {
    setIsUpdatingHaptics(true);

    try {
      await setHapticsEnabled(nextValue);

      if (nextValue) {
        triggerHaptic('optionSelected').catch(() => undefined);
      }
    } catch (error) {
      Alert.alert(
        'Haptics',
        error instanceof Error
          ? error.message
          : 'Unable to update your haptics preference right now.',
      );
    } finally {
      setIsUpdatingHaptics(false);
    }
  };

  const openDocument = (url: string, title: string) => {
    openExternalUrl(url, title).catch(error => {
      Alert.alert(
        title,
        error instanceof Error ? error.message : 'Unable to open this page right now.',
      );
    });
  };

  const openCredits = () => {
    triggerHaptic('legal').catch(() => undefined);
    openDeviceBrowserUrl('https://icons8.com').catch(error => {
      Alert.alert(
        'Credits',
        error instanceof Error ? error.message : 'Unable to open Credits right now.',
      );
    });
  };

  return (
    <View style={styles.personalizationSection}>
      <Text
        style={[styles.sectionEyebrow, { color: theme.colors.mutedForeground }]}
      >
        More
      </Text>
      <View
        style={[
          styles.personalizationList,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <SettingsListRow
          description="Feel touch feedback for actions"
          icon={SETTINGS_ICONS.haptics}
          label="Haptics"
          right={
            <SettingsToggle
              accessibilityLabel="Enable haptics"
              disabled={isUpdatingHaptics}
              onValueChange={handleHapticsChange}
              value={hapticsEnabled}
            />
          }
          showChevron={false}
        />
        <SettingsListRow
          accessibilityLabel="Open privacy policy"
          description="How we handle your data"
          icon={SETTINGS_ICONS.privacyPolicy}
          label="Privacy Policy"
          onPress={() =>
            openDocument(LEGAL_URLS.privacyPolicy, 'Privacy Policy')
          }
        />
        <SettingsListRow
          accessibilityLabel="Open terms of service"
          description="Rules for using Journal.IO"
          icon={SETTINGS_ICONS.termsOfService}
          label="Terms of Service"
          onPress={() =>
            openDocument(LEGAL_URLS.termsOfService, 'Terms of Service')
          }
        />
        <SettingsListRow
          accessibilityLabel="Open privacy choices"
          description="Manage your privacy preferences"
          icon={SETTINGS_ICONS.privacyChoices}
          label="Privacy Choices"
          onPress={() =>
            openDocument(LEGAL_URLS.privacyChoices, 'Privacy Choices')
          }
        />
        <SettingsListRow
          accessibilityLabel="Open Credits"
          description="People and tools that help shape Journal.IO"
          icon={SETTINGS_ICONS.credits}
          label="Credits"
          onPress={openCredits}
        />
      </View>
    </View>
  );
}

export function SettingsSupportSection() {
  const theme = useTheme();

  const openHelpCenter = () => {
    openExternalUrl(LEGAL_URLS.supportPage, 'Help Center').catch(error => {
      Alert.alert(
        'Help Center',
        error instanceof Error ? error.message : 'Unable to open Help Center right now.',
      );
    });
  };

  return (
    <View style={styles.personalizationSection}>
      <Text
        style={[styles.sectionEyebrow, { color: theme.colors.mutedForeground }]}
      >
        Support
      </Text>
      <View
        style={[
          styles.personalizationList,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <SettingsListRow
          accessibilityLabel="Open Help Center"
          description="Find help or raise a support ticket"
          icon={SETTINGS_ICONS.support}
          label="Help Center"
          onPress={openHelpCenter}
        />
      </View>
    </View>
  );
}

export function SettingsSignOutSection({
  onSignOut,
}: {
  onSignOut: () => Promise<void> | void;
}) {
  const theme = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await onSignOut();
    } catch (error) {
      Alert.alert(
        'Sign out',
        error instanceof Error
          ? error.message
          : 'Unable to sign out right now. Please try again.',
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Pressable
      accessibilityLabel="Sign out"
      accessibilityRole="button"
      accessibilityState={{ busy: isSigningOut, disabled: isSigningOut }}
      disabled={isSigningOut}
      onPress={handleSignOut}
      style={({ pressed }) => [
        styles.signOutButton,
        {
          backgroundColor: theme.colors.card,
          borderColor: `${theme.colors.destructive}33`,
        },
        pressed && !isSigningOut && styles.pressed,
        isSigningOut && styles.rowDisabled,
      ]}
    >
      <ButtonLoadingContent
        contentStyle={styles.signOutLabel}
        loaderColor={theme.colors.destructive}
        loading={isSigningOut}
      >
        <LogOut size={18} color={theme.colors.destructive} />
        <Text style={[styles.signOutText, { color: theme.colors.destructive }]}>
          Sign out
        </Text>
      </ButtonLoadingContent>
    </Pressable>
  );
}

export function SettingsPrivacyDataSection({
  onOpenExport,
  onOpenHidePreviewsPaywall,
  onOpenBiometricLock,
  onOpenPrivacyModePaywall,
}: SettingsPrivacyDataSectionProps) {
  const theme = useTheme();
  const sessionUser = useAppStore(state => state.session?.user ?? null);
  const isPremiumUser = Boolean(sessionUser?.isPremium);
  const isAiAnalysisEnabled = useAppStore(
    state => state.session?.user.aiOptIn !== false,
  );
  const hideJournalPreviews = useAppStore(state => state.hideJournalPreviews);
  const setHideJournalPreviews = useAppStore(
    state => state.setHideJournalPreviews,
  );
  const biometricLockEnabled = useAppStore(state => state.biometricLockEnabled);
  const biometricLockType = useAppStore(state => state.biometricLockType);
  const setSessionAiOptIn = useAppStore(state => state.setSessionAiOptIn);
  const [isUpdatingAiAnalysis, setIsUpdatingAiAnalysis] = useState(false);
  const [isUpdatingPreviewPrivacy, setIsUpdatingPreviewPrivacy] =
    useState(false);

  const handleOpenPrivacyModePaywall = () => {
    trackPaywallEvent({
      placementKey: 'settings_privacy_mode_locked',
      screenKey: 'settings',
      eventType: 'locked_feature_tap',
      wasInterruptive: false,
    }).catch(() => undefined);
    onOpenPrivacyModePaywall();
  };

  const handleOpenHidePreviewsPaywall = () => {
    trackPaywallEvent({
      placementKey: 'settings_hide_previews_locked',
      screenKey: 'settings',
      eventType: 'locked_feature_tap',
      wasInterruptive: false,
    }).catch(() => undefined);
    onOpenHidePreviewsPaywall();
  };

  const handleAiAnalysisChange = async (nextValue: boolean) => {
    if (!isPremiumUser) {
      handleOpenPrivacyModePaywall();
      return;
    }

    setIsUpdatingAiAnalysis(true);

    try {
      const result = await updateAiOptOutPreference(!nextValue);
      setSessionAiOptIn(result.aiOptIn);
    } catch (error) {
      Alert.alert(
        'AI analysis',
        error instanceof Error
          ? error.message
          : 'Unable to update your AI analysis preference right now.',
      );
    } finally {
      setIsUpdatingAiAnalysis(false);
    }
  };

  const handlePreviewPrivacyChange = async (nextValue: boolean) => {
    if (!isPremiumUser) {
      handleOpenHidePreviewsPaywall();
      return;
    }

    setIsUpdatingPreviewPrivacy(true);

    try {
      await setHideJournalPreviews(nextValue);
    } catch (error) {
      Alert.alert(
        'Hide entries',
        error instanceof Error
          ? error.message
          : 'Unable to update this device privacy setting right now.',
      );
    } finally {
      setIsUpdatingPreviewPrivacy(false);
    }
  };

  const premiumBadge = (
    <View
      style={[
        styles.lockBadge,
        { backgroundColor: `${theme.colors.primary}1A` },
      ]}
    >
      <Lock size={13} color={theme.colors.primary} />
      <Text style={[styles.lockText, { color: theme.colors.primary }]}>
        Premium
      </Text>
    </View>
  );
  const biometricLockLabel = getBiometricLockLabel(biometricLockType);
  const showBiometricLockRow = Platform.OS === 'ios';

  return (
    <View style={styles.personalizationSection}>
      <Text
        style={[styles.sectionEyebrow, { color: theme.colors.mutedForeground }]}
      >
        Privacy & Data
      </Text>
      <View
        style={[
          styles.personalizationList,
          { borderTopColor: theme.colors.border },
        ]}
      >
        {showBiometricLockRow ? (
          <SettingsListRow
            accessibilityLabel={`Open ${biometricLockLabel}`}
            description="Keep Journal.IO private"
            icon={SETTINGS_ICONS.biometricLock}
            label={biometricLockLabel}
            onPress={onOpenBiometricLock}
            right={
              biometricLockEnabled ? (
                <Text
                  style={[styles.valueText, { color: theme.colors.primary }]}
                >
                  On
                </Text>
              ) : undefined
            }
          />
        ) : null}
        <SettingsListRow
          description="Use AI for reflections"
          icon={SETTINGS_ICONS.aiAnalysis}
          label="Enable AI analysis"
          onPress={isPremiumUser ? undefined : handleOpenPrivacyModePaywall}
          accessibilityLabel={isPremiumUser ? undefined : 'Unlock Privacy Mode'}
          right={
            isPremiumUser ? (
              <SettingsToggle
                disabled={isUpdatingAiAnalysis}
                onValueChange={handleAiAnalysisChange}
                value={isAiAnalysisEnabled}
              />
            ) : (
              premiumBadge
            )
          }
          showChevron={false}
        />
        <SettingsListRow
          description="Mask journal previews"
          icon={SETTINGS_ICONS.hideEntries}
          label="Hide entries"
          onPress={isPremiumUser ? undefined : handleOpenHidePreviewsPaywall}
          accessibilityLabel={
            isPremiumUser ? undefined : 'Unlock Hide Journal Previews'
          }
          right={
            isPremiumUser ? (
              <SettingsToggle
                disabled={isUpdatingPreviewPrivacy}
                onValueChange={handlePreviewPrivacyChange}
                value={hideJournalPreviews}
              />
            ) : (
              premiumBadge
            )
          }
          showChevron={false}
        />
        <SettingsListRow
          description="Download your journal data"
          icon={SETTINGS_ICONS.exportData}
          label="Export data"
          onPress={onOpenExport}
        />
      </View>
    </View>
  );
}

export default function SettingsScreen({
  onBack,
  onOpenAboutYou = () => undefined,
  onOpenManageAccount = () => undefined,
  onOpenNotifications = () => undefined,
  onOpenPrivacy,
  onOpenPrivacyModePaywall,
  onOpenHidePreviewsPaywall,
  onOpenBiometricLock,
  onOpenSubscription = () => undefined,
  onOpenTheme = () => undefined,
  onSignOut,
  currentThemePreference,
}: SettingsScreenProps) {
  return (
    <ProfileSectionLayout title="Settings" onBack={onBack}>
      <SettingsAccountSection
        onOpenManageAccount={onOpenManageAccount}
        onOpenSubscription={onOpenSubscription}
      />

      <SettingsPersonalizationSection
        currentThemePreference={currentThemePreference}
        onOpenAboutYou={onOpenAboutYou}
        onOpenNotifications={onOpenNotifications}
        onOpenTheme={onOpenTheme}
      />

      <SettingsPrivacyDataSection
        onOpenExport={onOpenPrivacy}
        onOpenHidePreviewsPaywall={onOpenHidePreviewsPaywall}
        onOpenBiometricLock={onOpenBiometricLock}
        onOpenPrivacyModePaywall={onOpenPrivacyModePaywall}
      />

      <SettingsMoreSection />

      <SettingsSupportSection />

      <SettingsSignOutSection onSignOut={onSignOut} />
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  personalizationSection: {
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  personalizationList: {
    borderTopWidth: 1,
  },
  personalizationRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#00000000',
    flexDirection: 'row',
    gap: 12,
    minHeight: 74,
  },
  rowDisabled: {
    opacity: 0.66,
  },
  personalizationIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowIcon: {
    height: 30,
    width: 30,
  },
  personalizationCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  personalizationLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  personalizationDescription: {
    fontSize: 13,
  },
  themeValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  themeDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  valueText: {
    fontSize: 14,
  },
  toggleSlot: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 40,
    justifyContent: 'center',
    width: 48,
  },
  toggleControl: {
    transform: [{ scale: 0.9 }],
  },
  signOutButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
    position: 'relative',
  },
  signOutLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  lockBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  lockText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
});
