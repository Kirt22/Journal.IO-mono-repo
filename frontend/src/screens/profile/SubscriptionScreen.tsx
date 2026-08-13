import HapticPressable from '../../components/HapticPressable';
import {
  useEffect,
  useMemo,
  useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import {
  ExternalLink,
  RefreshCcw,
} from 'lucide-react-native';
import { ProfileSectionLayout, SectionCard } from './ProfileSectionLayout';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import { useTheme } from '../../theme/provider';
import {
  findRevenueCatPackageByProductIdentifier,
  getRevenueCatActiveEntitlement,
  getRevenueCatOfferings,
  getRevenueCatPurchaseAttribution,
  hasPremiumAccess,
  refreshRevenueCatEntitlementState,
  resolveProductPriceString,
  restoreRevenueCatPurchases,
} from '../../services/revenueCatService';
import { cancelFreeTrialEndingReminder } from '../../services/reminderNotificationsService';
import {
  isRetryableEntitlementSyncError,
  syncPaywallPurchase,
} from '../../services/paywallService';
import { useAppStore } from '../../store/appStore';
import {
  getPurchaseErrorMessage,
  NO_RESTORED_PURCHASE_MESSAGE,
  NO_RESTORED_PURCHASE_TITLE,
  PURCHASE_UPDATING_SUCCESS_MESSAGE,
  PURCHASE_UPDATING_SUCCESS_TITLE,
} from './paywallShared';

type SubscriptionPlanKey =
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'lifetime'
  | null
  | undefined;

type SubscriptionScreenProps = {
  onBack: () => void;
  currentPlanKey?: SubscriptionPlanKey;
};

const formatMembershipDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const getPlanLabel = (planKey?: SubscriptionPlanKey) => {
  switch (planKey) {
    case 'weekly':
      return 'Weekly Premium';
    case 'monthly':
      return 'Monthly Premium';
    case 'yearly':
      return 'Yearly Premium';
    case 'lifetime':
      return 'Lifetime Premium';
    default:
      return 'Premium';
  }
};

const getManageSubscriptionUrl = (planKey?: SubscriptionPlanKey) => {
  if (planKey === 'lifetime') {
    return null;
  }

  if (Platform.OS === 'ios') {
    return 'https://apps.apple.com/account/subscriptions';
  }

  if (Platform.OS === 'android') {
    return 'https://play.google.com/store/account/subscriptions';
  }

  return null;
};

export default function SubscriptionScreen({
  onBack,
  currentPlanKey,
}: SubscriptionScreenProps) {
  const theme = useTheme();
  const sessionUser = useAppStore(state => state.session?.user ?? null);
  const sessionUserId = useAppStore(
    state => state.session?.user.userId ?? null,
  );
  const setSessionUserProfile = useAppStore(
    state => state.setSessionUserProfile,
  );
  const activePlanLabel = getPlanLabel(currentPlanKey);
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasActiveEntitlement, setHasActiveEntitlement] = useState<
    boolean | null
  >(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState('Active');
  const [priceLabel, setPriceLabel] = useState('Loading...');
  const [activeThroughLabel, setActiveThroughLabel] = useState(
    currentPlanKey === 'lifetime'
      ? 'Lifetime'
      : formatMembershipDate(sessionUser?.premiumExpiresAt) ??
          'Current billing period',
  );

  const manageSubscriptionUrl = useMemo(
    () => getManageSubscriptionUrl(currentPlanKey),
    [currentPlanKey],
  );
  const managesRenewingSubscription = Boolean(manageSubscriptionUrl);
  const subscriptionDetails = [
    { label: 'Status', value: subscriptionStatus },
    { label: 'Plan', value: activePlanLabel },
    { label: 'Price', value: priceLabel },
    { label: 'Active through', value: activeThroughLabel },
  ];

  useEffect(() => {
    let isActive = true;

    const loadMembershipStatus = async () => {
      setIsCheckingMembership(true);

      try {
        const entitlementState = await refreshRevenueCatEntitlementState(
          sessionUserId,
        );

        if (!isActive) {
          return;
        }

        setHasActiveEntitlement(entitlementState.hasPremiumAccess);

        const activeEntitlement = entitlementState.activeEntitlement;
        const isTrial = activeEntitlement?.periodType === 'TRIAL';
        const isCancelling = sessionUser?.premiumWillRenew === false;

        setSubscriptionStatus(
          isTrial ? 'Trial' : isCancelling ? 'Cancelling' : 'Active',
        );
        setActiveThroughLabel(
          currentPlanKey === 'lifetime'
            ? 'Lifetime'
            : formatMembershipDate(
                sessionUser?.premiumExpiresAt ??
                  activeEntitlement?.expirationDate,
              ) ?? 'Current billing period',
        );

        if (isTrial) {
          setPriceLabel('Free trial');
          return;
        }

        const productIdentifier =
          activeEntitlement?.productIdentifier ??
          sessionUser?.premiumProductId ??
          null;

        if (!productIdentifier) {
          setPriceLabel(
            currentPlanKey === 'lifetime'
              ? 'One-time purchase'
              : 'App Store price',
          );
          return;
        }

        const offerings = await getRevenueCatOfferings(sessionUserId);

        if (!isActive) {
          return;
        }

        const currentPackage = findRevenueCatPackageByProductIdentifier(
          offerings,
          productIdentifier,
        );

        setPriceLabel(
          resolveProductPriceString(currentPackage?.product) ||
            (currentPlanKey === 'lifetime'
              ? 'One-time purchase'
              : 'App Store price'),
        );
      } catch {
        if (!isActive) {
          return;
        }

        setHasActiveEntitlement(null);
        setPriceLabel(
          currentPlanKey === 'lifetime'
            ? 'One-time purchase'
            : 'App Store price',
        );
      } finally {
        if (isActive) {
          setIsCheckingMembership(false);
        }
      }
    };

    loadMembershipStatus().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [
    currentPlanKey,
    sessionUser?.premiumExpiresAt,
    sessionUser?.premiumProductId,
    sessionUser?.premiumWillRenew,
    sessionUserId,
  ]);

  const handleManageSubscription = async () => {
    if (!manageSubscriptionUrl) {
      Alert.alert(
        'No subscription to manage',
        'Lifetime access is a one-time purchase, so there is no recurring subscription to manage.',
      );
      return;
    }

    try {
      await Linking.openURL(manageSubscriptionUrl);
    } catch {
      Alert.alert(
        'Open subscription settings',
        'Open your store subscription settings manually if the direct link is unavailable on this device.',
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (hasActiveEntitlement) {
      Alert.alert(
        'Membership already active',
        'This membership is already active on your account, so there is nothing to restore right now.',
      );
      return;
    }

    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);
      const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);
      const premiumAccess = hasPremiumAccess(customerInfo);

      if (!premiumAccess || !activeEntitlement) {
        Alert.alert(NO_RESTORED_PURCHASE_TITLE, NO_RESTORED_PURCHASE_MESSAGE);
        return;
      }

      const offerings = await getRevenueCatOfferings(sessionUserId);
      const attribution = getRevenueCatPurchaseAttribution(
        customerInfo,
        offerings,
      );

      if (!attribution) {
        Alert.alert(
          'Restore unavailable',
          'We could not match this membership to your purchase details right now. Please try again.',
        );
        return;
      }

      let updatedProfile;

      try {
        updatedProfile = await syncPaywallPurchase({
          offeringKey: attribution.offeringKey,
          revenueCatOfferingId: attribution.revenueCatOfferingId,
          revenueCatPackageId: attribution.revenueCatPackageId,
          store: attribution.activeEntitlement.store || 'unknown',
          entitlementId: attribution.activeEntitlement.identifier,
          wasRestore: true,
        });
      } catch (error) {
        // The store already confirmed the purchase; the server is just still
        // verifying it. Reporting that as a restore failure would tell the user
        // something is wrong with a purchase that is fine.
        if (isRetryableEntitlementSyncError(error)) {
          Alert.alert(
            PURCHASE_UPDATING_SUCCESS_TITLE,
            PURCHASE_UPDATING_SUCCESS_MESSAGE,
          );
          return;
        }

        throw error;
      }

      setSessionUserProfile(updatedProfile);
      cancelFreeTrialEndingReminder().catch(() => undefined);
      setHasActiveEntitlement(true);

      Alert.alert(
        'Purchases restored',
        'Your premium membership has been refreshed on this account.',
      );
    } catch (error) {
      if (__DEV__) {
        console.warn('[RevenueCat] Subscription restore failed.', error);
      }

      Alert.alert('Restore failed', getPurchaseErrorMessage(error));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ProfileSectionLayout
      title="Subscription"
      onBack={onBack}
      backgroundTintColor={hexToRgba(theme.colors.primary, 0.025)}
    >
      <SectionCard style={styles.detailsCard}>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Subscription details
        </Text>
        <View style={styles.detailsList}>
          {subscriptionDetails.map((detail, index) => (
            <View
              key={detail.label}
              style={[
                styles.detailsRow,
                index < subscriptionDetails.length - 1 &&
                  styles.detailsRowWithDivider,
                index < subscriptionDetails.length - 1 && {
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.detailsLabel,
                  { color: theme.colors.foreground },
                ]}
              >
                {detail.label}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.detailsValue,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {detail.value}
              </Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard backgroundColor={theme.colors.secondary}>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Membership actions
        </Text>
        <View style={styles.actionStack}>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Restore Purchases"
            accessibilityState={{
              busy: isRestoring || isCheckingMembership,
              disabled:
                isRestoring ||
                isCheckingMembership ||
                hasActiveEntitlement === true,
            }}
            onPress={handleRestorePurchases}
            disabled={
              isRestoring ||
              isCheckingMembership ||
              hasActiveEntitlement === true
            }
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity:
                  isRestoring ||
                  isCheckingMembership ||
                  hasActiveEntitlement === true
                    ? 0.6
                    : 1,
              },
              pressed && styles.pressed,
            ]}
          >
            <ButtonLoadingContent
              contentStyle={styles.actionButtonContent}
              loaderColor={theme.colors.primary}
              loading={isCheckingMembership || isRestoring}
              style={styles.actionButtonLoadingContent}
            >
            <View style={styles.actionButtonCopy}>
              <Text
                style={[
                  styles.actionButtonTitle,
                  { color: theme.colors.foreground },
                ]}
              >
                {hasActiveEntitlement
                  ? 'Membership already active'
                  : 'Restore Purchases'}
              </Text>
              <Text
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {hasActiveEntitlement
                  ? 'This account already has active premium access, so restore is not needed right now.'
                  : 'Use this if you already paid on this account and premium access has not refreshed yet.'}
              </Text>
            </View>
            {!isCheckingMembership && !isRestoring ? (
              <RefreshCcw size={18} color={theme.colors.primary} />
            ) : null}
            </ButtonLoadingContent>
          </HapticPressable>

          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Manage Subscription"
            onPress={handleManageSubscription}
            disabled={!managesRenewingSubscription}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: managesRenewingSubscription ? 1 : 0.6,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.actionButtonCopy}>
              <Text
                style={[
                  styles.actionButtonTitle,
                  { color: theme.colors.foreground },
                ]}
              >
                {managesRenewingSubscription
                  ? 'Manage Subscription'
                  : 'No recurring subscription'}
              </Text>
              <Text
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {managesRenewingSubscription
                  ? 'Open subscription settings to manage renewal, cancellation, or billing changes.'
                  : 'Lifetime access does not require store subscription management.'}
              </Text>
            </View>
            <ExternalLink size={18} color={theme.colors.primary} />
          </HapticPressable>
        </View>
      </SectionCard>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  detailsCard: {
    paddingBottom: 0,
  },
  detailsList: {
    marginTop: 8,
  },
  detailsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    minHeight: 58,
  },
  detailsRowWithDivider: {
    borderBottomWidth: 1,
  },
  detailsLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailsValue: {
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  actionStack: {
    marginTop: 14,
    gap: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionButtonCopy: {
    flex: 1,
  },
  actionButtonLoadingContent: {
    alignSelf: 'stretch',
    flex: 1,
  },
  actionButtonContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 14,
  },
  actionButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.84,
  },
});
