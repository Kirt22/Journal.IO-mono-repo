import { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import PremiumUpgradeCard from '../../components/PremiumUpgradeCard';
import {
  canAccessBiometricLock,
  getBiometricLockLabel,
  getBiometricMethodName,
} from '../../services/biometricLockService';
import { trackPaywallEvent } from '../../services/paywallService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import { ProfileSectionLayout, SectionCard } from './ProfileSectionLayout';

type BiometricLockScreenProps = {
  onBack: () => void;
  onOpenPremium: () => void;
};

export default function BiometricLockScreen({
  onBack,
  onOpenPremium,
}: BiometricLockScreenProps) {
  const theme = useTheme();
  const sessionUser = useAppStore(state => state.session?.user ?? null);
  const hasBiometricLockAccess = canAccessBiometricLock(sessionUser);
  const biometricLockEnabled = useAppStore(state => state.biometricLockEnabled);
  const biometricLockIsAvailable = useAppStore(
    state => state.biometricLockIsAvailable,
  );
  const biometricLockIsSupported = useAppStore(
    state => state.biometricLockIsSupported,
  );
  const biometricLockType = useAppStore(state => state.biometricLockType);
  const refreshBiometricLockState = useAppStore(
    state => state.refreshBiometricLockState,
  );
  const setBiometricLockEnabled = useAppStore(
    state => state.setBiometricLockEnabled,
  );
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    refreshBiometricLockState().catch(() => undefined);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        refreshBiometricLockState().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [refreshBiometricLockState]);

  const biometricLockLabel = getBiometricLockLabel(biometricLockType);
  const methodName = getBiometricMethodName(biometricLockType);
  const isBiometricUnavailable = !biometricLockIsSupported;
  const needsBiometricPermission =
    biometricLockIsSupported && !biometricLockIsAvailable;
  const isToggleLocked =
    !hasBiometricLockAccess ||
    isBiometricUnavailable ||
    needsBiometricPermission;
  const toggleMethodName = biometricLockType
    ? methodName
    : 'Face ID or Touch ID';
  const toggleDescription = !hasBiometricLockAccess
    ? 'Premium is required to turn on app lock.'
    : isBiometricUnavailable
    ? 'Face ID or Touch ID is unavailable on this iPhone.'
    : needsBiometricPermission
    ? `Allow ${methodName} in iPhone Settings to turn on app lock.`
    : `Require ${methodName} when you return to Journal.IO.`;

  const handleOpenPremium = () => {
    trackPaywallEvent({
      placementKey: 'settings_biometric_lock_locked',
      screenKey: 'biometric_lock',
      eventType: 'locked_feature_tap',
      wasInterruptive: false,
    }).catch(() => undefined);
    onOpenPremium();
  };

  const handleChange = async (nextValue: boolean) => {
    if (isToggleLocked) {
      return;
    }

    setIsUpdating(true);

    try {
      const result = await setBiometricLockEnabled(nextValue);

      if (result.status === 'enabled' || result.status === 'disabled') {
        return;
      }

      Alert.alert(
        result.availability.label,
        result.status === 'cancelled'
          ? 'Journal.IO will keep app lock off until you confirm it on this iPhone.'
          : result.message || 'Unable to update app lock right now.',
      );
    } catch (error) {
      Alert.alert(
        biometricLockLabel,
        error instanceof Error
          ? error.message
          : 'Unable to update app lock right now.',
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenBiometricSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        'Open device settings',
        `Open iPhone Settings and allow ${methodName} for Journal.IO.`,
      );
    }
  };

  return (
    <ProfileSectionLayout title={biometricLockLabel} onBack={onBack}>
      {!hasBiometricLockAccess ? (
        <PremiumUpgradeCard
          accessibilityLabel="Unlock biometric lock"
          description="App lock is included with Journal.IO Premium."
          onPress={handleOpenPremium}
          title="Premium privacy"
        />
      ) : null}

      {hasBiometricLockAccess && isBiometricUnavailable ? (
        <SectionCard>
          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: `${theme.colors.warning}1A` },
              ]}
            >
              <ShieldAlert size={20} color={theme.colors.warning} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                Face ID or Touch ID is unavailable
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                This iPhone cannot use Face ID or Touch ID for app lock.
              </Text>
            </View>
          </View>
        </SectionCard>
      ) : null}

      {hasBiometricLockAccess && needsBiometricPermission ? (
        <Pressable
          accessibilityLabel={`Allow ${methodName} for Journal.IO`}
          accessibilityRole="button"
          onPress={handleOpenBiometricSettings}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <SectionCard>
            <View style={styles.header}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${theme.colors.warning}1A` },
                ]}
              >
                <ShieldAlert size={20} color={theme.colors.warning} />
              </View>
              <View style={styles.copy}>
                <Text
                  style={[styles.title, { color: theme.colors.foreground }]}
                >
                  Allow {methodName}
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Enable {methodName} for Journal.IO in iPhone Settings.
                </Text>
              </View>
            </View>
          </SectionCard>
        </Pressable>
      ) : null}

      <SectionCard>
        <View style={styles.toggleRow}>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.colors.foreground }]}>
              Use {toggleMethodName}
            </Text>
            <Text
              style={[styles.subtitle, { color: theme.colors.mutedForeground }]}
            >
              {toggleDescription}
            </Text>
          </View>
          <Switch
            accessibilityLabel={`Use ${toggleMethodName}`}
            disabled={isToggleLocked || isUpdating}
            onValueChange={handleChange}
            thumbColor={theme.colors.card}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            value={biometricLockEnabled}
          />
        </View>
      </SectionCard>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  pressed: {
    opacity: 0.86,
  },
});
