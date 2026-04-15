import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CheckCircle2,
  Crown,
  ExternalLink,
  RefreshCcw,
  Sparkles,
} from "lucide-react-native";
import { ProfileSectionLayout, SectionCard } from "./ProfileSectionLayout";
import { useTheme } from "../../theme/provider";
import {
  getRevenueCatActiveEntitlement,
  getRevenueCatOfferings,
  getRevenueCatPackageMetadataForPlanKey,
  hasPremiumAccess,
  refreshRevenueCatEntitlementState,
  restoreRevenueCatPurchases,
} from "../../services/revenueCatService";
import { syncPaywallPurchase } from "../../services/paywallService";
import { useAppStore } from "../../store/appStore";

type SubscriptionPlanKey = "weekly" | "monthly" | "yearly" | "lifetime" | null | undefined;

type SubscriptionScreenProps = {
  onBack: () => void;
  currentPlanKey?: SubscriptionPlanKey;
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");

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
    case "weekly":
      return "Weekly Premium";
    case "monthly":
      return "Monthly Premium";
    case "yearly":
      return "Yearly Premium";
    case "lifetime":
      return "Lifetime Premium";
    default:
      return "Premium";
  }
};

const getRenewalLabel = (planKey?: SubscriptionPlanKey) => {
  switch (planKey) {
    case "weekly":
      return "Your membership renews every week unless you cancel it from your subscription settings.";
    case "monthly":
      return "Your membership renews every month unless you cancel it from your subscription settings.";
    case "yearly":
      return "Your membership renews every year unless you cancel it from your subscription settings.";
    case "lifetime":
      return "One-time purchase. No renewal is required.";
    default:
      return "Your membership stays active according to the plan on this account.";
  }
};

const getManageSubscriptionUrl = (planKey?: SubscriptionPlanKey) => {
  if (planKey === "lifetime") {
    return null;
  }

  if (Platform.OS === "ios") {
    return "https://apps.apple.com/account/subscriptions";
  }

  if (Platform.OS === "android") {
    return "https://play.google.com/store/account/subscriptions";
  }

  return null;
};

const getRevenueCatPlanKey = (planKey?: SubscriptionPlanKey) => {
  switch (planKey) {
    case "weekly":
      return "weekly" as const;
    case "monthly":
      return "monthly" as const;
    case "yearly":
      return "annual" as const;
    case "lifetime":
      return "lifetime" as const;
    default:
      return null;
  }
};

const getHeroText = (planKey?: SubscriptionPlanKey) => {
  switch (planKey) {
    case "weekly":
      return "Your weekly membership is active. You have full access to premium journaling and insight tools while this plan stays active.";
    case "monthly":
      return "Your monthly membership is active. You can keep using the full premium journaling experience across the app.";
    case "yearly":
      return "Your yearly membership is active. You have uninterrupted access to premium journaling, insights, and privacy tools.";
    case "lifetime":
      return "Your lifetime membership is active. You have one-time premium access across Journal.IO without any renewal.";
    default:
      return "Your premium membership is active on this account.";
  }
};

const getMembershipHighlights = (planKey?: SubscriptionPlanKey) => {
  const renewalByPlan: Record<Exclude<SubscriptionPlanKey, null | undefined>, string> =
    {
      weekly:
        "This plan keeps premium access flexible with a weekly renewal rhythm.",
      monthly:
        "This plan keeps premium access steady with a simple month-to-month renewal rhythm.",
      yearly:
        "This plan keeps premium access settled for the long term with yearly renewal.",
      lifetime:
        "This plan is a one-time unlock, so there is no future renewal to manage.",
    };

  const planBody =
    planKey && renewalByPlan[planKey]
      ? renewalByPlan[planKey]
      : "This membership keeps your premium access available on this account.";

  return [
    {
      icon: Sparkles,
      title: "Premium tools stay unlocked",
      body: "AI tagging, quick analysis, deeper insights, and premium privacy controls remain available while this membership is active.",
    },
    {
      icon: CheckCircle2,
      title: "Your current plan",
      body: planBody,
    },
    {
      icon: RefreshCcw,
      title: "Billing help lives in settings",
      body:
        planKey === "lifetime"
          ? "There is nothing to renew for this plan, so you can simply keep using Journal.IO."
          : "If you ever need to change or cancel this plan, use the subscription settings linked below.",
    },
  ];
};

export default function SubscriptionScreen({
  onBack,
  currentPlanKey,
}: SubscriptionScreenProps) {
  const theme = useTheme();
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const activePlanLabel = getPlanLabel(currentPlanKey);
  const renewalLabel = getRenewalLabel(currentPlanKey);
  const heroText = getHeroText(currentPlanKey);
  const membershipHighlights = getMembershipHighlights(currentPlanKey);
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasActiveEntitlement, setHasActiveEntitlement] = useState<boolean | null>(
    null
  );

  const manageSubscriptionUrl = useMemo(
    () => getManageSubscriptionUrl(currentPlanKey),
    [currentPlanKey]
  );
  const managesRenewingSubscription = Boolean(manageSubscriptionUrl);

  useEffect(() => {
    let isActive = true;

    const loadMembershipStatus = async () => {
      setIsCheckingMembership(true);

      try {
        const entitlementState = await refreshRevenueCatEntitlementState(
          sessionUserId
        );

        if (!isActive) {
          return;
        }

        setHasActiveEntitlement(entitlementState.hasPremiumAccess);
      } catch {
        if (!isActive) {
          return;
        }

        setHasActiveEntitlement(null);
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
  }, [sessionUserId]);

  const handleManageSubscription = async () => {
    if (!manageSubscriptionUrl) {
      Alert.alert(
        "No subscription to manage",
        "Lifetime access is a one-time purchase, so there is no recurring subscription to manage."
      );
      return;
    }

    try {
      await Linking.openURL(manageSubscriptionUrl);
    } catch {
      Alert.alert(
        "Open subscription settings",
        "Open your store subscription settings manually if the direct link is unavailable on this device."
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (hasActiveEntitlement) {
      Alert.alert(
        "Membership already active",
        "This membership is already active on your account, so there is nothing to restore right now."
      );
      return;
    }

    const revenueCatPlanKey = getRevenueCatPlanKey(currentPlanKey);

    if (!revenueCatPlanKey) {
      Alert.alert(
        "Restore unavailable",
        "This membership is missing plan metadata, so restore cannot sync safely right now."
      );
      return;
    }

    const offeringKey = currentPlanKey as Exclude<
      SubscriptionPlanKey,
      null | undefined
    >;

    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);
      const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);
      const premiumAccess = hasPremiumAccess(customerInfo);

      if (!premiumAccess || !activeEntitlement) {
        Alert.alert(
          "No active purchase found",
          "RevenueCat did not return an active premium entitlement for this account."
        );
        return;
      }

      const offerings = await getRevenueCatOfferings(sessionUserId);
      const packageMetadata = getRevenueCatPackageMetadataForPlanKey(
        offerings,
        revenueCatPlanKey
      );

      if (!packageMetadata.revenueCatOfferingId || !packageMetadata.revenueCatPackageId) {
        Alert.alert(
          "Restore unavailable",
          "RevenueCat returned an active entitlement, but the live package metadata could not be matched safely for this plan."
        );
        return;
      }

      const updatedProfile = await syncPaywallPurchase({
        offeringKey,
        revenueCatOfferingId: packageMetadata.revenueCatOfferingId,
        revenueCatPackageId: packageMetadata.revenueCatPackageId,
        store: activeEntitlement.store || "unknown",
        entitlementId: activeEntitlement.identifier || "unknown",
        wasRestore: true,
      });

      setSessionUserProfile(updatedProfile);
      setHasActiveEntitlement(true);

      Alert.alert(
        "Purchases restored",
        "Your premium membership has been refreshed on this account."
      );
    } catch (error) {
      if (__DEV__) {
        console.warn("[RevenueCat] Subscription restore failed.", error);
      }

      Alert.alert(
        "Restore failed",
        error instanceof Error
          ? error.message
          : "We could not restore purchases right now."
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ProfileSectionLayout
      title="Subscription"
      subtitle="Your current premium membership"
      onBack={onBack}
      backgroundTintColor={hexToRgba(theme.colors.primary, 0.025)}
    >
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
          <Crown size={24} color={theme.colors.primaryForeground} />
        </View>
        <Text style={[styles.heroTitle, { color: theme.colors.foreground }]}>
          {activePlanLabel}
        </Text>
        <Text style={[styles.heroText, { color: theme.colors.mutedForeground }]}>
          {heroText}
        </Text>
      </View>

      <SectionCard>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
            ]}
          >
            <CheckCircle2 size={14} color={theme.colors.primary} />
            <Text style={[styles.statusPillText, { color: theme.colors.primary }]}>
              Premium active
            </Text>
          </View>
        </View>

        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Current plan
        </Text>
        <Text style={[styles.planValue, { color: theme.colors.foreground }]}>
          {activePlanLabel}
        </Text>
        <Text style={[styles.planDetail, { color: theme.colors.mutedForeground }]}>
          {renewalLabel}
        </Text>
        <Text style={[styles.planMeta, { color: theme.colors.mutedForeground }]}>
          {currentPlanKey === "lifetime"
            ? "Your membership is already fully unlocked for this account."
            : "Your membership remains available as long as this plan stays active."}
        </Text>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Membership details
        </Text>

        <View style={styles.highlightStack}>
          {membershipHighlights.map(item => {
            const Icon = item.icon;

            return (
              <View key={item.title} style={styles.highlightRow}>
                <View
                  style={[
                    styles.highlightIconWrap,
                    { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
                  ]}
                >
                  <Icon size={16} color={theme.colors.primary} />
                </View>
                <View style={styles.highlightCopy}>
                  <Text style={[styles.highlightTitle, { color: theme.colors.foreground }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.highlightBody,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard backgroundColor={theme.colors.secondary}>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Membership actions
        </Text>
        <View style={styles.actionStack}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restore Purchases"
            onPress={handleRestorePurchases}
            disabled={isRestoring || isCheckingMembership || hasActiveEntitlement === true}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity:
                  isRestoring || isCheckingMembership || hasActiveEntitlement === true
                    ? 0.6
                    : 1,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.actionButtonCopy}>
              <Text style={[styles.actionButtonTitle, { color: theme.colors.foreground }]}>
                {isCheckingMembership
                  ? "Checking membership..."
                  : isRestoring
                    ? "Restoring purchases..."
                    : hasActiveEntitlement
                      ? "Membership already active"
                      : "Restore Purchases"}
              </Text>
              <Text
                style={[styles.actionButtonText, { color: theme.colors.mutedForeground }]}
              >
                {hasActiveEntitlement
                  ? "This account already has active premium access, so restore is not needed right now."
                  : "Use this if you already paid on this account and premium access has not refreshed yet."}
              </Text>
            </View>
            {isCheckingMembership || isRestoring ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <RefreshCcw size={18} color={theme.colors.primary} />
            )}
          </Pressable>

          <Pressable
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
              <Text style={[styles.actionButtonTitle, { color: theme.colors.foreground }]}>
                {managesRenewingSubscription
                  ? "Manage Subscription"
                  : "No recurring subscription"}
              </Text>
              <Text
                style={[styles.actionButtonText, { color: theme.colors.mutedForeground }]}
              >
                {managesRenewingSubscription
                  ? "Open subscription settings to manage renewal, cancellation, or billing changes."
                  : "Lifetime access does not require store subscription management."}
              </Text>
            </View>
            <ExternalLink size={18} color={theme.colors.primary} />
          </Pressable>

        </View>
      </SectionCard>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  statusRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  planValue: {
    marginTop: 10,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  planDetail: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  planMeta: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  highlightStack: {
    marginTop: 14,
    gap: 14,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  highlightIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightCopy: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  highlightBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  actionStack: {
    marginTop: 14,
    gap: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  actionButtonCopy: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 14,
    fontWeight: "600",
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
