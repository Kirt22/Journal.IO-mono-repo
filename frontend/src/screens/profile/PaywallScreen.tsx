import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  BellRing,
  Brain,
  Check,
  CreditCard,
  Download,
  LockOpen,
  Sparkles,
  Star,
  X,
} from "lucide-react-native";
import {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
} from "react-native-purchases";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ActionSuccessScreen from "../../components/ActionSuccessScreen";
import PrimaryButton from "../../components/PrimaryButton";
import {
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatOfferings,
  getRevenueCatPaywallPlans,
  hasPremiumAccess,
  purchaseRevenueCatPackage,
  refreshRevenueCatEntitlementState,
  restoreRevenueCatPurchases,
} from "../../services/revenueCatService";
import {
  cancelFreeTrialEndingReminder,
  scheduleFreeTrialEndingReminder,
} from "../../services/reminderNotificationsService";
import {
  getPaywallConfig,
  syncPaywallPurchase,
  trackPaywallEvent,
  type ResolvedPaywallConfig,
} from "../../services/paywallService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import {
  buildFeatureCards,
  buildPaywallPlans,
  getPurchaseErrorMessage,
  getTrialFootnote,
  isPurchasesError,
  type PaywallPlan,
} from "./paywallShared";
import { getPaywallLayoutMetrics } from "./paywallLayout";

const mascotImage = require("../../assets/png/Masscott.png");

type PaywallScreenProps = {
  onBack: (reason?: "dismiss" | "continue") => void;
};

type ScreenState = "paywall" | "success";
type PostAuthStep = "trial" | "reminder" | "purchase";

const POST_AUTH_INTRO_FEATURES = [
  { icon: Sparkles, text: "Unlimited AI insights" },
  { icon: Brain, text: "Personalized daily prompts" },
  { icon: Download, text: "Export all your entries" },
] as const;

const POST_AUTH_TIMELINE = [
  {
    icon: LockOpen,
    title: "Today",
    description: "Unlock Premium",
    color: "success" as const,
  },
  {
    icon: BellRing,
    title: "Day 5",
    description: "Reminder sent",
    color: "warning" as const,
  },
  {
    icon: CreditCard,
    title: "Day 7",
    description: "Trial ends",
    color: "primary" as const,
  },
] as const;

const POST_AUTH_BENEFITS = [
  "Unlimited AI insights & personalized prompts",
  "Advanced analytics & emotion tracking",
  "Securely export all your entries",
] as const;

const isAnnualPaywallPlan = (plan: PaywallPlan) =>
  plan.planKey === "annual" || plan.offeringKey === "yearly";

const isWeeklyPaywallPlan = (plan: PaywallPlan) =>
  plan.planKey === "weekly" || plan.offeringKey === "weekly";

const syncTrialEndingReminderForActivation = (
  premiumActivatedAt: string | null | undefined,
  targetPlan: PaywallPlan,
  options: { wasRestore?: boolean } = {}
) => {
  if (options.wasRestore || !isAnnualPaywallPlan(targetPlan)) {
    cancelFreeTrialEndingReminder().catch(() => undefined);
    return;
  }

  scheduleFreeTrialEndingReminder(premiumActivatedAt ?? null, {
    requestPermission: true,
  }).catch(() => undefined);
};

const getPostAuthPlanName = (plan: PaywallPlan) => {
  if (isAnnualPaywallPlan(plan)) {
    return "Yearly";
  }

  if (isWeeklyPaywallPlan(plan)) {
    return "Weekly";
  }

  return plan.title
    .toLowerCase()
    .replace(/^\w/, character => character.toUpperCase());
};

const getPostAuthPlanPeriod = (plan: PaywallPlan) => {
  if (isAnnualPaywallPlan(plan)) {
    return "/yr";
  }

  if (isWeeklyPaywallPlan(plan)) {
    return "/wk";
  }

  return "";
};

const getPostAuthPlanDescription = (plan: PaywallPlan) => {
  if (isAnnualPaywallPlan(plan)) {
    return "Billed annually";
  }

  if (isWeeklyPaywallPlan(plan)) {
    return "Billed weekly";
  }

  return plan.subtitle;
};

const getPostAuthTrialBadgeLabel = (plan: PaywallPlan | null) => {
  if (!plan || !isAnnualPaywallPlan(plan)) {
    return "Instantly unlock premium";
  }

  return "7-DAY FREE TRIAL INCLUDED";
};

const getTimelineAccentColors = (
  color: "success" | "warning" | "primary",
  palette: ReturnType<typeof useTheme>["colors"]
) => {
  if (color === "success") {
    return {
      icon: palette.success,
      background: `${palette.success}14`,
    };
  }

  if (color === "warning") {
    return {
      icon: palette.warning,
      background: `${palette.warning}14`,
    };
  }

  return {
    icon: palette.primary,
    background: `${palette.primary}14`,
  };
};

function StepActionButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  elevated = true,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  elevated?: boolean;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.stepActionButton,
        {
          backgroundColor: theme.colors.primary,
        },
        elevated && {
          shadowColor: theme.colors.primary,
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.primaryForeground} />
      ) : (
        <Text
          style={[
            styles.stepActionButtonLabel,
            { color: theme.colors.primaryForeground },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function PlanCard({
  plan,
  selected,
  onPress,
}: {
  plan: PaywallPlan;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        {
          backgroundColor: selected ? theme.colors.accent : theme.colors.card,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.planHeaderRow}>
        <View style={styles.planTitleWrap}>
          <Text style={[styles.planTitle, { color: theme.colors.foreground }]}>
            {plan.title}
          </Text>
          <Text style={[styles.planSubtitle, { color: theme.colors.mutedForeground }]}>
            {plan.subtitle}
          </Text>
        </View>
        <View
          style={[
            styles.radioOuter,
            { borderColor: selected ? theme.colors.primary : theme.colors.border },
          ]}
        >
          {selected ? (
            <View
              style={[
                styles.radioInner,
                { backgroundColor: theme.colors.primary },
              ]}
            />
          ) : null}
        </View>
      </View>

      <Text style={[styles.planPrice, { color: theme.colors.foreground }]}>
        {plan.durationLabel}
      </Text>

      {plan.badge ? (
        <View
          style={[
            styles.planBadge,
            { backgroundColor: `${theme.colors.primary}16` },
          ]}
        >
          <Text style={[styles.planBadgeText, { color: theme.colors.primary }]}>
            {plan.badge}
          </Text>
        </View>
      ) : null}

      {plan.highlight ? (
        <Text style={[styles.planHighlight, { color: theme.colors.mutedForeground }]}>
          {plan.highlight}
        </Text>
      ) : null}
    </Pressable>
  );
}

function PostAuthPlanCard({
  plan,
  selected,
  onPress,
}: {
  plan: PaywallPlan;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isYearlyPlan = isAnnualPaywallPlan(plan);
  const badgeText = isYearlyPlan ? plan.badge || "Most Popular" : null;
  const savingsText = isYearlyPlan ? plan.highlight : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.postAuthPlanCard,
        {
          backgroundColor: selected ? `${theme.colors.primary}0D` : `${theme.colors.card}E6`,
          borderColor: selected ? theme.colors.primary : `${theme.colors.border}80`,
          shadowColor: selected ? theme.colors.primary : theme.colors.foreground,
        },
        pressed && styles.postAuthPlanPressed,
      ]}
    >
      {badgeText ? (
        <View
          style={[
            styles.postAuthPlanBadge,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text
            style={[
              styles.postAuthPlanBadgeText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            {badgeText}
          </Text>
        </View>
      ) : null}

      <View style={styles.postAuthPlanContent}>
        <View style={styles.postAuthPlanLeft}>
          <View
            style={[
              styles.postAuthRadioOuter,
              { borderColor: selected ? theme.colors.primary : theme.colors.border },
            ]}
          >
            {selected ? (
              <View
                style={[
                  styles.postAuthRadioFill,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <View style={styles.postAuthRadioInner} />
              </View>
            ) : null}
          </View>

          <View style={styles.postAuthPlanTextWrap}>
            <View style={styles.postAuthPlanNameRow}>
              <Text
                style={[styles.postAuthPlanName, { color: theme.colors.foreground }]}
              >
                {getPostAuthPlanName(plan)}
              </Text>
              {savingsText ? (
                <View
                  style={[
                    styles.postAuthSavingsPill,
                    { backgroundColor: `${theme.colors.success}14` },
                  ]}
                >
                  <Text
                    style={[
                      styles.postAuthSavingsText,
                      { color: theme.colors.success },
                    ]}
                  >
                    {savingsText}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[
                styles.postAuthPlanDescription,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {getPostAuthPlanDescription(plan)}
            </Text>
          </View>
        </View>

        <View style={styles.postAuthPriceWrap}>
          <Text style={[styles.postAuthPlanPrice, { color: theme.colors.foreground }]}>
            {plan.durationLabel}
          </Text>
          <Text
            style={[
              styles.postAuthPlanPeriod,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {getPostAuthPlanPeriod(plan)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function PaywallScreen({ onBack }: PaywallScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    horizontalPadding,
    isCompact,
    isVeryCompact,
    postAuthHeroTitleSize,
    postAuthTimelineMaxWidth,
    postAuthTopContentPadding,
  } = getPaywallLayoutMetrics(width);
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const isPremiumUser = useAppStore(state => Boolean(state.session?.user.isPremium));
  const activePaywallPlacementKey = useAppStore(
    state => state.activePaywallPlacementKey
  );
  const activePaywallScreenKey = useAppStore(state => state.activePaywallScreenKey);
  const activePaywallTriggerMode = useAppStore(
    state => state.activePaywallTriggerMode
  );
  const setSessionPremiumStatus = useAppStore(state => state.setSessionPremiumStatus);
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const [paywallConfig, setPaywallConfig] = useState<ResolvedPaywallConfig | null>(
    null
  );
  const [plans, setPlans] = useState<PaywallPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(
    getRevenueCatConfigurationError()
  );
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>("paywall");
  const [lastPurchaseStore, setLastPurchaseStore] = useState<string | null>(null);
  const [postAuthStep, setPostAuthStep] = useState<PostAuthStep>("trial");
  const introHeroProgress = useRef(new Animated.Value(0)).current;
  const introMascotFloat = useRef(new Animated.Value(0)).current;
  const introFeatureProgress = useRef(
    POST_AUTH_INTRO_FEATURES.map(() => new Animated.Value(0))
  ).current;
  const reminderScreenProgress = useRef(new Animated.Value(0)).current;
  const reminderBellSwing = useRef(new Animated.Value(0)).current;
  const reminderTimelineProgress = useRef(
    POST_AUTH_TIMELINE.map(() => new Animated.Value(0))
  ).current;
  const purchaseHeaderProgress = useRef(new Animated.Value(0)).current;
  const purchaseBannerProgress = useRef(new Animated.Value(0)).current;
  const purchasePlanListProgress = useRef(new Animated.Value(0)).current;
  const purchaseBenefitsProgress = useRef(new Animated.Value(0)).current;
  const purchaseFooterProgress = useRef(new Animated.Value(0)).current;
  const paywallContextRef = useRef({
    placementKey: activePaywallPlacementKey || "post_auth",
    screenKey: activePaywallScreenKey || null,
    triggerMode: activePaywallTriggerMode,
  });

  // Preserve the placement context for the lifetime of this mounted screen.
  // ScreenTransitionHost can keep a previous paywall screen mounted briefly while
  // the shell clears global paywall context, and we do not want that transient
  // reset to make this instance fall back to the default post-auth placement.
  const paywallPlacementKey = paywallContextRef.current.placementKey;
  const paywallScreenKey = paywallContextRef.current.screenKey;
  const paywallTriggerMode = paywallContextRef.current.triggerMode;
  const isPostAuthPaywall = paywallPlacementKey === "post_auth";
  const isModernPurchasePaywall =
    paywallPlacementKey !== "profile_upgrade_banner" &&
    paywallPlacementKey !== "post_auth_exit_offer";
  const featureCards = useMemo(() => buildFeatureCards(paywallConfig), [paywallConfig]);

  const visiblePlans = useMemo(() => {
    if (!isModernPurchasePaywall) {
      return plans;
    }

    const filteredPlans = plans
      .filter(plan => isAnnualPaywallPlan(plan) || isWeeklyPaywallPlan(plan))
      .sort((left, right) => {
        const leftPriority = isAnnualPaywallPlan(left) ? 0 : isWeeklyPaywallPlan(left) ? 1 : 2;
        const rightPriority = isAnnualPaywallPlan(right)
          ? 0
          : isWeeklyPaywallPlan(right)
            ? 1
            : 2;

        return leftPriority - rightPriority;
      });

    return filteredPlans.length ? filteredPlans : plans;
  }, [isModernPurchasePaywall, plans]);

  const selectedPlan =
    visiblePlans.find(plan => plan.id === selectedPlanId) ?? visiblePlans[0] ?? null;
  const trialFootnote = getTrialFootnote(selectedPlan ?? undefined, selectedPlan?.introOffer);
  const isBusy = isProcessing || isRestoring;
  const selectedPlanHasTrial = Boolean(
    selectedPlan && isAnnualPaywallPlan(selectedPlan)
  );
  const yearlyTrialPlan =
    visiblePlans.find(plan => isAnnualPaywallPlan(plan)) ?? null;
  const introButtonLabel = "Start 7-day free trial";

  useEffect(() => {
    let isMounted = true;

    const loadPaywall = async () => {
      setIsLoadingPlans(true);
      setPlansError(getRevenueCatConfigurationError());

      try {
        const resolvedConfig = sessionUserId
          ? await getPaywallConfig({
              placementKey: paywallPlacementKey,
              screenKey: paywallScreenKey || undefined,
              triggerMode: paywallTriggerMode,
            })
          : null;

        if (!isMounted) {
          return;
        }

        if (resolvedConfig) {
          setPaywallConfig(resolvedConfig);
        }

        if (resolvedConfig && !resolvedConfig.shouldShow) {
          onBack("continue");
          return;
        }

        const offerings = await getRevenueCatOfferings(sessionUserId);
        const livePlans = getRevenueCatPaywallPlans(
          offerings,
          resolvedConfig?.offerings
        );
        const nextPlans = buildPaywallPlans(livePlans, resolvedConfig);

        if (!isMounted) {
          return;
        }

        setPlans(nextPlans);
        setPlansError(
          nextPlans.some(plan => plan.rcPackage)
            ? null
            : "A live RevenueCat package is not available for this paywall yet."
        );

        if (resolvedConfig?.template) {
          trackPaywallEvent({
            placementKey: resolvedConfig.placementKey,
            screenKey: resolvedConfig.screenKey || undefined,
            eventType: "paywall_impression",
            templateKey: resolvedConfig.template.key,
            offeringKey:
              nextPlans.find(plan => plan.planKey === "annual")?.offeringKey ||
              nextPlans[0]?.offeringKey,
            wasInterruptive: resolvedConfig.wasInterruptive,
          }).catch(() => undefined);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPlansError(
          error instanceof Error
            ? error.message
            : "We could not load live billing plans right now."
        );
      } finally {
        if (isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    loadPaywall().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [
    onBack,
    paywallPlacementKey,
    paywallScreenKey,
    paywallTriggerMode,
    sessionUserId,
  ]);

  useEffect(() => {
    if (!visiblePlans.length) {
      setSelectedPlanId(null);
      return;
    }

    setSelectedPlanId(currentValue => {
      if (currentValue && visiblePlans.some(plan => plan.id === currentValue)) {
        return currentValue;
      }

      if (isModernPurchasePaywall) {
        return (
          visiblePlans.find(plan => isAnnualPaywallPlan(plan))?.id ||
          visiblePlans.find(plan => isWeeklyPaywallPlan(plan))?.id ||
          visiblePlans[0]?.id ||
          null
        );
      }

      return visiblePlans[0]?.id || null;
    });
  }, [isModernPurchasePaywall, visiblePlans]);

  useEffect(() => {
    if (isPremiumUser) {
      setScreenState("success");
    }
  }, [isPremiumUser]);

  useEffect(() => {
    introHeroProgress.stopAnimation();
    introMascotFloat.stopAnimation();
    introFeatureProgress.forEach(value => value.stopAnimation());

    if (!isPostAuthPaywall || postAuthStep !== "trial" || screenState !== "paywall") {
      introHeroProgress.setValue(0);
      introMascotFloat.setValue(0);
      introFeatureProgress.forEach(value => value.setValue(0));
      return;
    }

    introHeroProgress.setValue(0);
    introMascotFloat.setValue(0);
    introFeatureProgress.forEach(value => value.setValue(0));

    const heroEntrance = Animated.timing(introHeroProgress, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const featureEntrance = Animated.stagger(
      110,
      introFeatureProgress.map(value =>
        Animated.timing(value, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    );

    const mascotFloatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(introMascotFloat, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(introMascotFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    heroEntrance.start();
    featureEntrance.start();
    mascotFloatLoop.start();

    return () => {
      heroEntrance.stop();
      featureEntrance.stop();
      mascotFloatLoop.stop();
    };
  }, [
    introFeatureProgress,
    introHeroProgress,
    introMascotFloat,
    isPostAuthPaywall,
    postAuthStep,
    screenState,
  ]);

  useEffect(() => {
    reminderScreenProgress.stopAnimation();
    reminderBellSwing.stopAnimation();
    reminderTimelineProgress.forEach(value => value.stopAnimation());

    if (!isPostAuthPaywall || postAuthStep !== "reminder" || screenState !== "paywall") {
      reminderScreenProgress.setValue(0);
      reminderBellSwing.setValue(0);
      reminderTimelineProgress.forEach(value => value.setValue(0));
      return;
    }

    reminderScreenProgress.setValue(0);
    reminderBellSwing.setValue(0);
    reminderTimelineProgress.forEach(value => value.setValue(0));

    const reminderEntrance = Animated.timing(reminderScreenProgress, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const timelineEntrance = Animated.stagger(
      120,
      reminderTimelineProgress.map(value =>
        Animated.timing(value, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    );

    const bellLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(reminderBellSwing, {
          toValue: 1,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(reminderBellSwing, {
          toValue: -1,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(reminderBellSwing, {
          toValue: 0.75,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(reminderBellSwing, {
          toValue: 0,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
      ])
    );

    reminderEntrance.start();
    timelineEntrance.start();
    bellLoop.start();

    return () => {
      reminderEntrance.stop();
      timelineEntrance.stop();
      bellLoop.stop();
    };
  }, [
    isPostAuthPaywall,
    postAuthStep,
    reminderBellSwing,
    reminderScreenProgress,
    reminderTimelineProgress,
    screenState,
  ]);

  useEffect(() => {
    purchaseHeaderProgress.stopAnimation();
    purchaseBannerProgress.stopAnimation();
    purchasePlanListProgress.stopAnimation();
    purchaseBenefitsProgress.stopAnimation();
    purchaseFooterProgress.stopAnimation();

    const shouldAnimatePurchaseStep =
      screenState === "paywall" &&
      isModernPurchasePaywall &&
      (!isPostAuthPaywall || postAuthStep === "purchase");

    if (!shouldAnimatePurchaseStep) {
      purchaseHeaderProgress.setValue(0);
      purchaseBannerProgress.setValue(0);
      purchasePlanListProgress.setValue(0);
      purchaseBenefitsProgress.setValue(0);
      purchaseFooterProgress.setValue(0);
      return;
    }

    purchaseHeaderProgress.setValue(0);
    purchaseBannerProgress.setValue(0);
    purchasePlanListProgress.setValue(0);
    purchaseBenefitsProgress.setValue(0);
    purchaseFooterProgress.setValue(0);

    const purchaseEntrance = Animated.stagger(90, [
      Animated.timing(purchaseHeaderProgress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(purchaseBannerProgress, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(purchasePlanListProgress, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(purchaseBenefitsProgress, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(purchaseFooterProgress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    purchaseEntrance.start();

    return () => {
      purchaseEntrance.stop();
    };
  }, [
    isModernPurchasePaywall,
    isPostAuthPaywall,
    postAuthStep,
    purchaseBannerProgress,
    purchaseBenefitsProgress,
    purchaseFooterProgress,
    purchaseHeaderProgress,
    purchasePlanListProgress,
    screenState,
  ]);

  const completePremiumActivation = async (
    customerInfo: CustomerInfo,
    targetPlan: PaywallPlan,
    options: { wasRestore?: boolean } = {}
  ) => {
    const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);
    const premiumAccess = hasPremiumAccess(customerInfo);

    setLastPurchaseStore(activeEntitlement?.store ?? null);

    if (!premiumAccess) {
      return false;
    }

    if (!targetPlan.offeringKey) {
      await setSessionPremiumStatus(true);
      syncTrialEndingReminderForActivation(null, targetPlan, options);
      setScreenState("success");
      return true;
    }

    const updatedProfile = await syncPaywallPurchase({
      offeringKey: targetPlan.offeringKey,
      revenueCatOfferingId:
        targetPlan.revenueCatOfferingId || paywallPlacementKey,
      revenueCatPackageId:
        targetPlan.revenueCatPackageId || targetPlan.rcPackage?.identifier || "unknown",
      store: activeEntitlement?.store || "unknown",
      entitlementId: activeEntitlement?.identifier || "unknown",
      wasRestore: Boolean(options.wasRestore),
    });

    setSessionUserProfile(updatedProfile);
    syncTrialEndingReminderForActivation(
      updatedProfile.premiumActivatedAt,
      targetPlan,
      options
    );
    setScreenState("success");
    return true;
  };

  const finalizePremiumActivation = async (
    customerInfo: CustomerInfo,
    targetPlan: PaywallPlan,
    options: { wasRestore?: boolean } = {}
  ) => {
    const activated = await completePremiumActivation(customerInfo, targetPlan, options);

    if (activated || !sessionUserId) {
      return activated;
    }

    const refreshedEntitlementState = await refreshRevenueCatEntitlementState(
      sessionUserId
    );

    if (!refreshedEntitlementState.customerInfo) {
      return false;
    }

    return completePremiumActivation(
      refreshedEntitlementState.customerInfo,
      targetPlan,
      options
    );
  };

  const trackEvent = (
    eventType:
      | "paywall_dismiss"
      | "plan_select"
      | "cta_tap"
      | "purchase_success"
      | "restore_success"
      | "purchase_failure",
    metadata?: Record<string, unknown>
  ) => {
    if (!paywallConfig?.template) {
      return;
    }

    trackPaywallEvent({
      placementKey: paywallConfig.placementKey,
      screenKey: paywallConfig.screenKey || undefined,
      eventType,
      templateKey: paywallConfig.template.key,
      offeringKey: selectedPlan?.offeringKey,
      wasInterruptive: paywallConfig.wasInterruptive,
      metadata,
    }).catch(() => undefined);
  };

  const handleDismiss = () => {
    trackEvent("paywall_dismiss", isPostAuthPaywall ? { step: postAuthStep } : undefined);
    onBack("dismiss");
  };

  const handleContinueFromSuccess = () => {
    onBack("continue");
  };

  const handleUpgrade = async () => {
    if (!selectedPlan?.rcPackage) {
      Alert.alert(
        "Billing unavailable",
        plansError || "A live package is not available for the selected plan yet."
      );
      return;
    }

    setIsProcessing(true);

    try {
      trackEvent("cta_tap", isPostAuthPaywall ? { step: postAuthStep } : undefined);
      const purchaseResult = await purchaseRevenueCatPackage(
        selectedPlan.rcPackage,
        sessionUserId
      );
      const activated = await finalizePremiumActivation(
        purchaseResult.customerInfo,
        selectedPlan
      );

      if (!activated) {
        Alert.alert(
          "Purchase completed",
          "The store completed the purchase, but no active premium entitlement was returned yet."
        );
      } else {
        trackEvent("purchase_success");
      }
    } catch (error) {
      if (
        isPurchasesError(error) &&
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
      ) {
        return;
      }

      Alert.alert("Premium activation unavailable", getPurchaseErrorMessage(error));

      trackEvent("purchase_failure", {
        message: getPurchaseErrorMessage(error),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedPlan) {
      return;
    }

    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);
      const premiumAccess = hasPremiumAccess(customerInfo);

      if (!premiumAccess) {
        Alert.alert(
          "No purchases found",
          "The store did not return an active premium entitlement for this account."
        );
        return;
      }

      await finalizePremiumActivation(customerInfo, selectedPlan, {
        wasRestore: true,
      });
      trackEvent("restore_success");
    } catch (error) {
      Alert.alert("Restore purchases", getPurchaseErrorMessage(error));
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePlanPress = (plan: PaywallPlan) => {
    setSelectedPlanId(plan.id);
    trackEvent("plan_select", {
      planKey: plan.planKey,
    });
  };

  const renderPostAuthBackground = () => (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {postAuthStep === "trial" ? (
        <View
          style={[
            styles.postAuthGlow,
            styles.postAuthTrialGlow,
            { backgroundColor: `${theme.colors.primary}12` },
          ]}
        />
      ) : null}
      {postAuthStep === "reminder" ? (
        <View
          style={[
            styles.postAuthGlow,
            styles.postAuthReminderGlow,
            { backgroundColor: `${theme.colors.warning}10` },
          ]}
        />
      ) : null}
      {postAuthStep === "purchase" ? (
        <>
          <View
            style={[
              styles.postAuthGlow,
              styles.postAuthPurchaseGlowTop,
              { backgroundColor: `${theme.colors.primary}12` },
            ]}
          />
          <View
            style={[
              styles.postAuthGlow,
              styles.postAuthPurchaseGlowSide,
              { backgroundColor: `${theme.colors.accent}90` },
            ]}
          />
        </>
      ) : null}
    </View>
  );

  const renderPostAuthTrialStep = () => {
    const heroAnimatedStyle = {
      transform: [
        {
          translateY: introHeroProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          }),
        },
      ],
    };
    const mascotAnimatedStyle = {
      transform: [
        {
          scale: introHeroProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1],
          }),
        },
        {
          translateY: introMascotFloat.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -8],
          }),
        },
      ],
    };
    const footerAnimatedStyle = {
      transform: [
        {
          translateY: introHeroProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [22, 0],
          }),
        },
      ],
    };

    return (
      <View style={styles.postAuthScreen}>
        {renderPostAuthBackground()}

        <View
          style={[
            styles.postAuthStageInner,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.postAuthTrialContent,
              { paddingTop: postAuthTopContentPadding },
              heroAnimatedStyle,
            ]}
          >
            <Animated.View style={[styles.postAuthMascotWrap, mascotAnimatedStyle]}>
              <Image
                source={mascotImage}
                resizeMode="contain"
                style={[
                  styles.postAuthMascotImage,
                  isCompact ? styles.postAuthMascotImageCompact : null,
                ]}
              />
            </Animated.View>

            <Text
              style={[
                styles.postAuthHeroTitle,
                { color: theme.colors.foreground, fontSize: postAuthHeroTitleSize },
                isVeryCompact ? styles.postAuthHeroTitleCompact : null,
              ]}
            >
              Unlock your mind
            </Text>

            <View
              style={[
                styles.postAuthFeatureList,
                { maxWidth: postAuthTimelineMaxWidth },
              ]}
            >
              {POST_AUTH_INTRO_FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                const featureAnimatedStyle = {
                  transform: [
                    {
                      translateX: introFeatureProgress[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-14, 0],
                      }),
                    },
                    {
                      translateY: introFeatureProgress[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    },
                  ],
                };

                return (
                  <Animated.View
                    key={feature.text}
                    style={[
                      styles.postAuthFeatureCard,
                      {
                        backgroundColor: `${theme.colors.card}D9`,
                        borderColor: `${theme.colors.border}80`,
                      },
                      featureAnimatedStyle,
                    ]}
                  >
                    <View
                      style={[
                        styles.postAuthFeatureIconWrap,
                        { backgroundColor: `${theme.colors.primary}14` },
                      ]}
                    >
                      <Icon size={20} color={theme.colors.primary} />
                    </View>
                    <Text
                      style={[
                        styles.postAuthFeatureText,
                        { color: `${theme.colors.foreground}E6` },
                      ]}
                    >
                      {feature.text}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View style={[styles.postAuthFooter, footerAnimatedStyle]}>
            <StepActionButton
              label={yearlyTrialPlan ? introButtonLabel : "Continue to premium"}
              onPress={() => setPostAuthStep("reminder")}
              elevated={false}
            />
          </Animated.View>
        </View>
      </View>
    );
  };

  const renderPostAuthReminderStep = () => {
    const reminderContentAnimatedStyle = {
      transform: [
        {
          translateY: reminderScreenProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        },
      ],
    };
    const reminderBellAnimatedStyle = {
      transform: [
        {
          scale: reminderScreenProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.9, 1],
          }),
        },
        {
          rotate: reminderBellSwing.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: ["-10deg", "0deg", "10deg"],
          }),
        },
      ],
    };
    const reminderFooterAnimatedStyle = {
      transform: [
        {
          translateY: reminderScreenProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [24, 0],
          }),
        },
      ],
    };

    return (
      <View style={styles.postAuthScreen}>
        {renderPostAuthBackground()}

        <View
          style={[
            styles.postAuthStageInner,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.postAuthReminderContent,
              { paddingTop: postAuthTopContentPadding },
              reminderContentAnimatedStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.postAuthBellWrap,
                {
                  backgroundColor: `${theme.colors.warning}14`,
                  borderColor: `${theme.colors.warning}30`,
                  shadowColor: theme.colors.warning,
                },
                reminderBellAnimatedStyle,
              ]}
            >
              <BellRing size={40} color={theme.colors.warning} strokeWidth={1.6} />
            </Animated.View>

            <Text
              style={[
                styles.postAuthHeroTitle,
                { color: theme.colors.foreground, fontSize: postAuthHeroTitleSize },
                isVeryCompact ? styles.postAuthHeroTitleCompact : null,
              ]}
            >
              No surprises
            </Text>

            <Text
              style={[
                styles.postAuthReminderBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              We'll send you a push notification before your trial ends. Cancel anytime.
            </Text>

            <View
              style={[
                styles.postAuthTimelineWrap,
                { maxWidth: postAuthTimelineMaxWidth },
              ]}
            >
              <View
                style={[
                  styles.postAuthTimelineLine,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              {POST_AUTH_TIMELINE.map((step, index) => {
                const Icon = step.icon;
                const colors = getTimelineAccentColors(step.color, theme.colors);
                const timelineAnimatedStyle = {
                  transform: [
                    {
                      translateX: reminderTimelineProgress[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-16, 0],
                      }),
                    },
                  ],
                };

                return (
                  <Animated.View
                    key={step.title}
                    style={[styles.postAuthTimelineItem, timelineAnimatedStyle]}
                  >
                    <View
                      style={[
                        styles.postAuthTimelineIconWrap,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Icon size={22} color={colors.icon} />
                    </View>
                    <View style={styles.postAuthTimelineTextWrap}>
                      <Text
                        style={[
                          styles.postAuthTimelineTitle,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        {step.title}
                      </Text>
                      <Text
                        style={[
                          styles.postAuthTimelineDescription,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        {step.description}
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View style={[styles.postAuthFooter, reminderFooterAnimatedStyle]}>
            <StepActionButton
              label="Continue"
              onPress={() => setPostAuthStep("purchase")}
              elevated={false}
            />
          </Animated.View>
        </View>
      </View>
    );
  };

  const renderPostAuthPurchaseStep = () => {
    const purchaseHeaderAnimatedStyle = {
      transform: [
        {
          translateY: purchaseHeaderProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [16, 0],
          }),
        },
      ],
    };
    const purchaseBannerAnimatedStyle = {
      transform: [
        {
          translateY: purchaseBannerProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          }),
        },
      ],
    };
    const purchasePlanListAnimatedStyle = {
      transform: [
        {
          translateY: purchasePlanListProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [22, 0],
          }),
        },
      ],
    };
    const purchaseBenefitsAnimatedStyle = {
      transform: [
        {
          translateY: purchaseBenefitsProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [24, 0],
          }),
        },
      ],
    };
    const purchaseFooterAnimatedStyle = {
      transform: [
        {
          translateY: purchaseFooterProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [28, 0],
          }),
        },
      ],
    };

    return (
      <View style={styles.postAuthScreen}>
        {renderPostAuthBackground()}

        <View
          style={[
            styles.postAuthStageInner,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
        <Animated.View style={[styles.postAuthPurchaseHeader, purchaseHeaderAnimatedStyle]}>
          <View style={styles.postAuthBrandRow}>
            <View
              style={[
                styles.postAuthBrandIconWrap,
                { backgroundColor: `${theme.colors.primary}14` },
              ]}
            >
              <Star size={14} color={theme.colors.primary} fill={theme.colors.primary} />
            </View>
            <Text style={[styles.postAuthBrandText, { color: theme.colors.foreground }]}>
              Journal.IO Premium
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
            onPress={handleDismiss}
            style={({ pressed }) => [
              styles.purchaseCloseButton,
              {
                backgroundColor: `${theme.colors.card}E6`,
                borderWidth: 1,
                borderColor: theme.colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <X size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.postAuthPurchaseScroll}
          contentContainerStyle={[
            styles.postAuthPurchaseScrollContent,
            { paddingTop: postAuthTopContentPadding },
          ]}
        >
          <Animated.View
            style={[styles.postAuthTrialBannerSlot, purchaseBannerAnimatedStyle]}
          >
            {selectedPlanHasTrial ? (
              <View
                style={[
                  styles.postAuthTrialBanner,
                  { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary },
                ]}
              >
                <Sparkles size={12} color={theme.colors.primaryForeground} />
                <Text
                  style={[
                    styles.postAuthTrialBannerText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  {getPostAuthTrialBadgeLabel(selectedPlan)}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.postAuthInstantBanner,
                  { backgroundColor: theme.colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.postAuthInstantBannerText,
                    { color: theme.colors.secondaryForeground },
                  ]}
                >
                  Instantly unlock premium
                </Text>
              </View>
            )}
          </Animated.View>

          <Animated.View
            style={[styles.postAuthPurchasePlanList, purchasePlanListAnimatedStyle]}
          >
            {isLoadingPlans && !visiblePlans.length ? (
              <View
                style={[
                  styles.inlineLoaderCard,
                  {
                    backgroundColor: `${theme.colors.card}E6`,
                    borderColor: `${theme.colors.border}80`,
                  },
                ]}
              >
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text
                  style={[
                    styles.inlineLoaderText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Loading premium offers...
                </Text>
              </View>
            ) : (
              visiblePlans.map(plan => (
                <PostAuthPlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan?.id === plan.id}
                  onPress={() => handlePlanPress(plan)}
                />
              ))
            )}
          </Animated.View>

          <Animated.View
            style={[styles.postAuthBenefitsList, purchaseBenefitsAnimatedStyle]}
          >
            {POST_AUTH_BENEFITS.map(benefit => (
              <View key={benefit} style={styles.postAuthBenefitRow}>
                <View
                  style={[
                    styles.postAuthBenefitIconWrap,
                    { backgroundColor: `${theme.colors.primary}14` },
                  ]}
                >
                  <Check size={12} color={theme.colors.primary} strokeWidth={3} />
                </View>
                <Text
                  style={[
                    styles.postAuthBenefitText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {benefit}
                </Text>
              </View>
            ))}
          </Animated.View>

          {plansError ? (
            <View
              style={[
                styles.messageCard,
                {
                  backgroundColor: `${theme.colors.warning}12`,
                  borderColor: `${theme.colors.warning}30`,
                },
              ]}
            >
              <Text style={[styles.messageText, { color: theme.colors.foreground }]}>
                {plansError}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <Animated.View
          style={[
            styles.postAuthPurchaseFooter,
            purchaseFooterAnimatedStyle,
            {
              backgroundColor: `${theme.colors.background}F2`,
              borderTopColor: `${theme.colors.border}66`,
            },
          ]}
        >
          <Text
            style={[
              styles.postAuthDynamicPriceText,
              { color: theme.colors.foreground },
            ]}
          >
            {selectedPlan
              ? selectedPlanHasTrial
                ? `0 today, then ${selectedPlan.durationLabel}${getPostAuthPlanPeriod(selectedPlan)}`
                : `Billed ${selectedPlan.durationLabel} today`
              : "Select a premium plan"}
          </Text>

          <View style={styles.postAuthPurchaseActions}>
            <StepActionButton
              label={
                isProcessing
                  ? "Processing..."
                  : selectedPlanHasTrial
                    ? introButtonLabel
                    : "Subscribe Now"
              }
              onPress={() => {
                handleUpgrade().catch(() => undefined);
              }}
              disabled={!selectedPlan?.rcPackage || isLoadingPlans || isRestoring}
              loading={isProcessing}
              elevated={false}
            />

            <View
              style={[
                styles.postAuthFooterMetaRow,
                isCompact ? styles.postAuthFooterMetaRowCompact : null,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={handleRestore}
                disabled={isBusy || isLoadingPlans}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
                ) : (
                  <Text
                    style={[
                      styles.postAuthRestoreText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Restore purchases
                  </Text>
                )}
              </Pressable>

              <Text
                style={[
                  styles.postAuthRenewalText,
                  { color: `${theme.colors.mutedForeground}99` },
                ]}
              >
                Cancel anytime. Auto-renews.
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
  };

  const renderStandardPurchaseStep = () => (
    <View style={styles.standardPurchaseLayout}>
      <View style={styles.purchaseHero}>
        <Text style={[styles.purchaseTitle, { color: theme.colors.foreground }]}>
          {paywallConfig?.template?.title || "Unlock Journal.IO Premium"}
        </Text>
        <Text style={[styles.purchaseBody, { color: theme.colors.mutedForeground }]}>
          {paywallConfig?.template?.headline ||
            "Choose the premium plan that fits your journaling rhythm."}
        </Text>
      </View>

      <View style={styles.planList}>
        {isLoadingPlans && !visiblePlans.length ? (
          <View
            style={[
              styles.inlineLoaderCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text
              style={[
                styles.inlineLoaderText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Loading premium offers...
            </Text>
          </View>
        ) : (
          visiblePlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan?.id === plan.id}
              onPress={() => handlePlanPress(plan)}
            />
          ))
        )}
      </View>

      <View style={styles.featureList}>
        {featureCards.slice(0, 4).map(feature => (
          <View
            key={feature.title}
            style={[
              styles.featureRow,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.featureBullet,
                { backgroundColor: `${theme.colors.success}18` },
              ]}
            >
              <Check size={14} color={theme.colors.success} />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: theme.colors.foreground }]}>
                {feature.title}
              </Text>
              <Text style={[styles.featureBody, { color: theme.colors.mutedForeground }]}>
                {feature.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {plansError ? (
        <View
          style={[
            styles.messageCard,
            {
              backgroundColor: `${theme.colors.warning}12`,
              borderColor: `${theme.colors.warning}30`,
            },
          ]}
        >
          <Text style={[styles.messageText, { color: theme.colors.foreground }]}>
            {plansError}
          </Text>
        </View>
      ) : null}

      {trialFootnote ? (
        <Text style={[styles.helperText, { color: theme.colors.mutedForeground }]}>
          {trialFootnote}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <PrimaryButton
          label={
            isProcessing
              ? "Processing..."
              : selectedPlanHasTrial
                ? introButtonLabel
                : "Continue"
          }
          onPress={() => {
            handleUpgrade().catch(() => undefined);
          }}
          loading={isProcessing}
          tone="accent"
          disabled={!selectedPlan?.rcPackage || isLoadingPlans || isRestoring}
        />

        <Pressable
          onPress={handleRestore}
          disabled={isBusy || isLoadingPlans}
          style={styles.restoreAction}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
          ) : (
            <Text style={[styles.restoreText, { color: theme.colors.mutedForeground }]}>
              Restore Purchases
            </Text>
          )}
        </Pressable>

        <Text style={[styles.legalText, { color: theme.colors.mutedForeground }]}>
          {paywallConfig?.template?.footerLegal ||
            "Cancel anytime from your store subscription settings."}
        </Text>
      </View>
    </View>
  );

  if (screenState === "success") {
    return (
      <ActionSuccessScreen
        variant="payment"
        title="You're Premium"
        subtitle={
          lastPurchaseStore === "TEST_STORE"
            ? "The test purchase is active. You can continue into Journal.IO."
            : "Your premium access is now active on this account."
        }
        buttonLabel="Continue"
        onPrimaryAction={handleContinueFromSuccess}
      />
    );
  }

  return (
    <SafeAreaView
      edges={
        isModernPurchasePaywall && screenState === "paywall"
          ? []
          : ["top", "right", "bottom", "left"]
      }
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.container,
          !(isModernPurchasePaywall && screenState === "paywall") && {
            paddingHorizontal: horizontalPadding,
          },
        ]}
      >
        {isModernPurchasePaywall ? (
          isPostAuthPaywall ? (
            postAuthStep === "trial"
              ? renderPostAuthTrialStep()
              : postAuthStep === "reminder"
                ? renderPostAuthReminderStep()
                : renderPostAuthPurchaseStep()
          ) : (
            renderPostAuthPurchaseStep()
          )
        ) : (
          <>
            <View style={styles.standardHeader}>
              <View style={styles.standardHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                onPress={handleDismiss}
                style={({ pressed }) => [
                  styles.roundIconButton,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <X size={18} color={theme.colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {renderStandardPurchaseStep()}
            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  standardHeader: {
    alignItems: "flex-end",
    paddingVertical: 4,
  },
  standardHeaderSpacer: {
    width: 36,
    height: 36,
  },
  roundIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  purchaseCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.6,
  },
  stepActionButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepActionButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  postAuthScreen: {
    flex: 1,
    overflow: "hidden",
  },
  postAuthStageInner: {
    flex: 1,
  },
  postAuthGlow: {
    position: "absolute",
    borderRadius: 999,
  },
  postAuthTrialGlow: {
    width: 300,
    height: 300,
    top: "22%",
    left: "50%",
    marginLeft: -150,
  },
  postAuthReminderGlow: {
    width: 340,
    height: 340,
    top: -40,
    right: -130,
  },
  postAuthPurchaseGlowTop: {
    width: 280,
    height: 280,
    top: -140,
    right: -120,
  },
  postAuthPurchaseGlowSide: {
    width: 180,
    height: 180,
    top: "34%",
    left: -90,
  },
  postAuthHeaderEnd: {
    alignItems: "flex-end",
    paddingTop: 4,
  },
  postAuthTrialContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 32,
  },
  postAuthMascotWrap: {
    marginBottom: 32,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  postAuthMascotHalo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  postAuthMascotImage: {
    width: 112,
    height: 112,
  },
  postAuthMascotImageCompact: {
    width: 96,
    height: 96,
  },
  postAuthHeroTitle: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38,
    textAlign: "center",
    marginBottom: 24,
  },
  postAuthHeroTitleCompact: {
    lineHeight: 34,
    marginBottom: 20,
  },
  postAuthFeatureList: {
    width: "100%",
    gap: 14,
    maxWidth: 280,
  },
  postAuthFeatureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  postAuthFeatureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  postAuthFeatureText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  postAuthFooter: {
    gap: 14,
    paddingBottom: 12,
  },
  laterAction: {
    alignItems: "center",
    paddingVertical: 4,
  },
  laterActionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  postAuthReminderContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 44,
  },
  postAuthBellWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 38,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  postAuthReminderBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 34,
  },
  postAuthTimelineWrap: {
    width: "100%",
    gap: 24,
    position: "relative",
  },
  postAuthTimelineLine: {
    position: "absolute",
    left: 23,
    top: 24,
    bottom: 24,
    width: 2,
    borderRadius: 999,
  },
  postAuthTimelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    zIndex: 1,
  },
  postAuthTimelineIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  postAuthTimelineTextWrap: {
    flex: 1,
    gap: 2,
  },
  postAuthTimelineTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  postAuthTimelineDescription: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  postAuthPurchaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
    paddingBottom: 8,
  },
  postAuthBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postAuthBrandIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  postAuthBrandText: {
    fontSize: 14,
    fontWeight: "600",
  },
  postAuthPurchaseScroll: {
    flex: 1,
  },
  postAuthPurchaseScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 12,
  },
  postAuthTrialBannerSlot: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  postAuthTrialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  postAuthTrialBannerText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  postAuthInstantBanner: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  postAuthInstantBannerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  postAuthPurchasePlanList: {
    gap: 12,
    marginBottom: 20,
  },
  inlineLoaderCard: {
    minHeight: 112,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  inlineLoaderText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  postAuthPlanCard: {
    borderRadius: 24,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    position: "relative",
    overflow: "hidden",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  postAuthPlanPressed: {
    transform: [{ scale: 0.99 }],
  },
  postAuthPlanBadge: {
    position: "absolute",
    top: 0,
    right: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 1,
  },
  postAuthPlanBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  postAuthPlanContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  postAuthPlanLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 8,
  },
  postAuthRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  postAuthRadioFill: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  postAuthRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  postAuthPlanTextWrap: {
    flex: 1,
    gap: 3,
  },
  postAuthPlanNameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  postAuthPlanName: {
    fontSize: 17,
    fontWeight: "600",
  },
  postAuthSavingsPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  postAuthSavingsText: {
    fontSize: 10,
    fontWeight: "700",
  },
  postAuthPlanDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  postAuthPriceWrap: {
    alignItems: "flex-end",
    minWidth: 58,
  },
  postAuthPlanPrice: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  postAuthPlanPeriod: {
    fontSize: 10,
    marginTop: 4,
  },
  postAuthBenefitsList: {
    gap: 10,
    paddingHorizontal: 2,
  },
  postAuthBenefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  postAuthBenefitIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  postAuthBenefitText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  postAuthPurchaseFooter: {
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
    borderTopWidth: 1,
  },
  postAuthDynamicPriceText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  postAuthPurchaseActions: {
    gap: 10,
  },
  postAuthFooterMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
  },
  postAuthFooterMetaRowCompact: {
    flexDirection: "column",
  },
  postAuthRestoreText: {
    fontSize: 11,
    fontWeight: "500",
  },
  postAuthRenewalText: {
    fontSize: 10,
    textAlign: "right",
  },
  postAuthLegalText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  standardPurchaseLayout: {
    gap: 18,
    paddingTop: 8,
    paddingBottom: 24,
  },
  purchaseHero: {
    alignItems: "center",
    gap: 10,
  },
  purchaseTitle: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    textAlign: "center",
  },
  purchaseBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 330,
  },
  planList: {
    gap: 12,
  },
  planCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  planHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  planTitleWrap: {
    flex: 1,
    gap: 4,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  planSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planPrice: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 30,
  },
  planBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  planHighlight: {
    fontSize: 12,
    lineHeight: 18,
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  featureBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureCopy: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  featureBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  messageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  footer: {
    gap: 12,
  },
  restoreAction: {
    alignItems: "center",
    paddingVertical: 4,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: "500",
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
