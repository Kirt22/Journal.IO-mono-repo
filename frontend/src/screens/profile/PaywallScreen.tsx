import HapticPressable from '../../components/HapticPressable';
import {
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Text,
} from "../../infrastructure/reactNative";
import { Check, X } from "lucide-react-native";
import {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOfferings,
} from "react-native-purchases";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ActionSuccessScreen from "../../components/ActionSuccessScreen";
import ButtonLoadingContent from "../../components/ButtonLoadingContent";
import JournalLoader from '../../components/JournalLoader';
import PriceText from "../../components/PriceText";
import Orb from "../../components/orb";
import {
  getAmbientOrbOpacity,
  getOrbAccents,
} from "../../constants/orbPalette";
import { triggerHaptic } from "../../services/hapticsService";
import {
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatOfferings,
  getRevenueCatPaywallPlans,
  getRevenueCatPurchaseAttribution,
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
  isRetryableEntitlementSyncError,
  syncPaywallPurchase,
  trackPaywallEvent,
  type ResolvedPaywallConfig,
} from "../../services/paywallService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import { LEGAL_URLS, openExternalUrl } from "../../utils/legalLinks";
import {
  buildPaywallPlans,
  getIntroOfferLabel,
  getPlanPriceLabel,
  getPurchaseErrorMessage,
  getTrialFootnote,
  isPurchasesError,
  NO_RESTORED_PURCHASE_MESSAGE,
  NO_RESTORED_PURCHASE_TITLE,
  PURCHASE_UPDATING_SUCCESS_MESSAGE,
  PURCHASE_UPDATING_SUCCESS_TITLE,
  type PaywallPlan,
} from "./paywallShared";
import { getPaywallContent } from "./paywallContent";

type PaywallScreenProps = {
  onBack: (reason?: "dismiss" | "continue") => void;
};

type ScreenState = "paywall" | "success";

const PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE =
  "Premium plans are temporarily unavailable. Please try again later.";

const isAnnualPaywallPlan = (plan: PaywallPlan) =>
  plan.planKey === "annual" || plan.offeringKey === "yearly";

const isWeeklyPaywallPlan = (plan: PaywallPlan) =>
  plan.planKey === "weekly" || plan.offeringKey === "weekly";

const getPlanName = (plan: PaywallPlan) => {
  if (isAnnualPaywallPlan(plan)) {
    return "Yearly";
  }
  if (isWeeklyPaywallPlan(plan)) {
    return "Weekly";
  }
  return plan.title.replace(/^\w/, character => character.toUpperCase());
};

const syncTrialEndingReminderForActivation = (
  premiumExpiresAt: string | null | undefined,
  premiumWillRenew: boolean | null | undefined,
  targetPlan: PaywallPlan,
  options: { wasRestore?: boolean } = {}
) => {
  if (
    options.wasRestore ||
    premiumWillRenew === false ||
    !isAnnualPaywallPlan(targetPlan) ||
    !targetPlan.introOffer?.isFreeTrial
  ) {
    cancelFreeTrialEndingReminder().catch(() => undefined);
    return;
  }

  scheduleFreeTrialEndingReminder(premiumExpiresAt ?? null, {
    requestPermission: true,
  }).catch(() => undefined);
};

/**
 * The ambient orb runs well past the screen edge so only its lit rim is in
 * frame, and sits high enough that the glow lands behind the headline rather
 * than behind the feature rows.
 */
const AMBIENT_ORB_WIDTH_FACTOR = 1.5;
const AMBIENT_ORB_CENTER_FACTOR = 0.3;
/** Long enough to read as the content stepping aside for the orb, not a cut. */
const DISMISS_FADE_MS = 160;
/** Ink, not `foreground` — a light shadow on dark would halo, not deepen. */
const PAYWALL_SHADOW_COLOR = "#000000";

export default function PaywallScreen({ onBack }: PaywallScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const isPremiumUser = useAppStore(state => Boolean(state.session?.user.isPremium));
  const activePaywallPlacementKey = useAppStore(
    state => state.activePaywallPlacementKey
  );
  const activePaywallScreenKey = useAppStore(state => state.activePaywallScreenKey);
  const activePaywallTriggerMode = useAppStore(
    state => state.activePaywallTriggerMode
  );
  const isPaywallOverlay = useAppStore(state => state.isPaywallOverlay);
  const beginOrbHandoff = useAppStore(state => state.beginOrbHandoff);
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);

  const [paywallConfig, setPaywallConfig] = useState<ResolvedPaywallConfig | null>(
    null
  );
  const [plans, setPlans] = useState<PaywallPlan[]>([]);
  const [revenueCatOfferings, setRevenueCatOfferings] =
    useState<PurchasesOfferings | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(
    getRevenueCatConfigurationError()
  );
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>("paywall");
  const [lastPurchaseStore, setLastPurchaseStore] = useState<string | null>(null);
  const [isPurchaseAccessUpdating, setIsPurchaseAccessUpdating] = useState(false);
  // Measured height of the pinned footer so the scroll content clears it.
  const [footerHeight, setFooterHeight] = useState(0);
  // Set the instant the hand-off starts, so this screen's orb disappears before
  // the overlay's copy appears and the two are never on screen together.
  const [isOrbHandedOff, setIsOrbHandedOff] = useState(false);
  const isDismissingRef = useRef(false);

  // Entrance animations: hero -> bullets -> footer slide-up.
  const heroAnim = useRef(new Animated.Value(0)).current;
  const bulletsAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  // Package-switch feedback: a scale pop on the selected card + a fade on the
  // CTA label when it changes.
  const cardScale = useRef(new Animated.Value(1)).current;
  const ctaFade = useRef(new Animated.Value(1)).current;

  // Preserve the placement context for the lifetime of this mounted screen — a
  // transient global reset must not swap the copy mid-life.
  const paywallContextRef = useRef({
    placementKey: activePaywallPlacementKey || "post_auth",
    screenKey: activePaywallScreenKey || null,
    triggerMode: activePaywallTriggerMode,
    isOverlay: isPaywallOverlay,
  });
  const paywallPlacementKey = paywallContextRef.current.placementKey;
  const paywallScreenKey = paywallContextRef.current.screenKey;
  const paywallTriggerMode = paywallContextRef.current.triggerMode;
  /**
   * Root paywalls — post-onboarding, and the relaunch route for a non-premium
   * user — replaced the navigation root and exit by resetting to Home, so they
   * are exactly the ones whose orb can be handed to the Home hero. A contextual
   * paywall pops back to whatever screen raised it and keeps the plain
   * background.
   */
  const isRootPaywall = !paywallContextRef.current.isOverlay;

  const copy = useMemo(
    () => getPaywallContent(paywallPlacementKey, paywallScreenKey),
    [paywallPlacementKey, paywallScreenKey]
  );

  const orbAccents = useMemo(() => getOrbAccents(theme.mode), [theme.mode]);
  const ambientOrbOpacity = getAmbientOrbOpacity(theme.mode);
  // Dark needs a much heavier cast to register at all against a near-black page.
  const footerShadowOpacity = theme.mode === "dark" ? 0.5 : 0.08;
  /**
   * Computed rather than measured: the layer is absolutely positioned off these
   * exact numbers, so measuring would only re-derive them, and the hand-off has
   * to know the frame at the moment of the tap — before any layout pass.
   */
  const ambientOrbFrame = useMemo(() => {
    if (!isRootPaywall) {
      return null;
    }

    const size = Math.round(windowWidth * AMBIENT_ORB_WIDTH_FACTOR);

    return {
      x: Math.round((windowWidth - size) / 2),
      y: Math.round(windowHeight * AMBIENT_ORB_CENTER_FACTOR - size / 2),
      size,
    };
  }, [isRootPaywall, windowHeight, windowWidth]);

  // Show annual first, then weekly.
  const visiblePlans = useMemo(() => {
    const filtered = plans
      .filter(plan => isAnnualPaywallPlan(plan) || isWeeklyPaywallPlan(plan))
      .sort((left, right) => {
        const leftRank = isAnnualPaywallPlan(left) ? 0 : 1;
        const rightRank = isAnnualPaywallPlan(right) ? 0 : 1;
        return leftRank - rightRank;
      });
    return filtered.length ? filtered : plans;
  }, [plans]);

  const selectedPlan =
    visiblePlans.find(plan => plan.id === selectedPlanId) ?? visiblePlans[0] ?? null;
  // The yearly plan carries the free trial. Drive the trial framing off the plan
  // type so the CTA/timeline stay correct even if the store's intro-offer data
  // is momentarily unavailable; use the real trial duration when we have it.
  const selectedIsAnnual = selectedPlan ? isAnnualPaywallPlan(selectedPlan) : false;
  const selectedTrialDuration =
    selectedPlan?.introOffer?.durationLabel || "7-day";
  const trialFootnote = getTrialFootnote(
    selectedPlan ?? undefined,
    selectedPlan?.introOffer
  );
  const isBusy = isProcessing || isRestoring;
  const ctaLabel = selectedIsAnnual
    ? `Start ${selectedTrialDuration} free trial`
    : "Continue to Premium";

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
          resolvedConfig?.offerings,
          { placementKey: paywallPlacementKey }
        );
        const nextPlans = buildPaywallPlans(livePlans, resolvedConfig);

        if (!isMounted) {
          return;
        }

        setRevenueCatOfferings(offerings);
        setPlans(nextPlans);
        setPlansError(
          nextPlans.some(plan => plan.rcPackage)
            ? null
            : PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE
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
        console.warn("[Paywall] Failed to load purchase options", error);
        setPlansError(PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE);
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
      // Prefer the plan that carries the free trial (yearly), so the CTA leads
      // with "Start … free trial". Fall back to annual, then the first plan.
      return (
        visiblePlans.find(plan => plan.introOffer?.isFreeTrial)?.id ||
        visiblePlans.find(plan => isAnnualPaywallPlan(plan))?.id ||
        visiblePlans[0]?.id ||
        null
      );
    });
  }, [visiblePlans]);

  useEffect(() => {
    if (isPremiumUser) {
      setIsPurchaseAccessUpdating(false);
      setScreenState("success");
    }
  }, [isPremiumUser]);

  // Staggered entrance: hero -> bullets -> footer. Respects Reduce Motion.
  useEffect(() => {
    let isActive = true;
    let animation: Animated.CompositeAnimation | null = null;

    const settle = () => {
      animation?.stop();
      heroAnim.setValue(1);
      bulletsAnim.setValue(1);
      footerAnim.setValue(1);
    };

    const reveal = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const play = () => {
      if (!isActive) {
        return;
      }
      heroAnim.setValue(0);
      bulletsAnim.setValue(0);
      footerAnim.setValue(0);
      animation = Animated.sequence([
        Animated.delay(120),
        reveal(heroAnim, 420),
        reveal(bulletsAnim, 380),
        reveal(footerAnim, 440),
      ]);
      animation.start();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!isActive) {
          return;
        }
        if (enabled) {
          settle();
        } else {
          play();
        }
      })
      .catch(play);

    return () => {
      isActive = false;
      animation?.stop();
    };
  }, [bulletsAnim, footerAnim, heroAnim]);

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

  const completePremiumActivation = async (
    customerInfo: CustomerInfo,
    targetPlan: PaywallPlan,
    options: { wasRestore?: boolean } = {}
  ) => {
    const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);
    const premiumAccess = hasPremiumAccess(customerInfo);
    const attribution = getRevenueCatPurchaseAttribution(
      customerInfo,
      revenueCatOfferings
    );

    setLastPurchaseStore(activeEntitlement?.store ?? null);

    if (!premiumAccess || !attribution) {
      return false;
    }

    let updatedProfile;

    try {
      updatedProfile = await syncPaywallPurchase({
        offeringKey: attribution.offeringKey,
        revenueCatOfferingId: attribution.revenueCatOfferingId,
        revenueCatPackageId: attribution.revenueCatPackageId,
        store: attribution.activeEntitlement.store || "unknown",
        entitlementId: attribution.activeEntitlement.identifier,
        wasRestore: Boolean(options.wasRestore),
      });
    } catch (error) {
      if (isRetryableEntitlementSyncError(error)) {
        setIsPurchaseAccessUpdating(true);
        setScreenState("success");
        return "pending";
      }
      throw error;
    }

    setSessionUserProfile(updatedProfile);
    syncTrialEndingReminderForActivation(
      updatedProfile.premiumExpiresAt,
      updatedProfile.premiumWillRenew,
      targetPlan,
      options
    );
    setIsPurchaseAccessUpdating(false);
    setScreenState("success");
    return true;
  };

  const finalizePremiumActivation = async (
    customerInfo: CustomerInfo,
    targetPlan: PaywallPlan,
    options: { wasRestore?: boolean } = {}
  ) => {
    const activated = await completePremiumActivation(customerInfo, targetPlan, options);

    if (activated !== false || !sessionUserId) {
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

  const handleDismiss = () => {
    trackEvent("paywall_dismiss");
    triggerHaptic("back").catch(() => undefined);

    if (!isRootPaywall || !ambientOrbFrame) {
      onBack("dismiss");
      return;
    }

    // Fade the copy and the plan footer out from under the orb, then let the
    // overlay carry the orb through the root reset into Home. Guarded so a
    // double-tap on the close button can't start two hand-offs.
    if (isDismissingRef.current) {
      return;
    }
    isDismissingRef.current = true;
    setIsOrbHandedOff(true);
    beginOrbHandoff(ambientOrbFrame);

    const finish = () => {
      onBack("dismiss");
    };

    if (typeof jest !== "undefined") {
      finish();
      return;
    }

    Animated.parallel(
      [heroAnim, bulletsAnim, footerAnim].map(value =>
        Animated.timing(value, {
          toValue: 0,
          duration: DISMISS_FADE_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start(finish);
  };

  const handleContinueFromSuccess = () => {
    onBack("continue");
  };

  const handlePlanPress = (plan: PaywallPlan) => {
    if (plan.id === selectedPlanId) {
      return;
    }
    setSelectedPlanId(plan.id);
    triggerHaptic("optionSelected").catch(() => undefined);
    trackEvent("plan_select", { planKey: plan.planKey });

    // Pop the newly-selected card and cross-fade the CTA label as it changes.
    cardScale.setValue(0.94);
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 5,
      tension: 150,
      useNativeDriver: true,
    }).start();
    ctaFade.setValue(0.25);
    Animated.timing(ctaFade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleUpgrade = async () => {
    if (isBusy) {
      return;
    }
    if (!selectedPlan?.rcPackage) {
      Alert.alert(
        "Billing unavailable",
        plansError || PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE
      );
      return;
    }

    setIsProcessing(true);
    triggerHaptic("primaryAction").catch(() => undefined);

    try {
      trackEvent("cta_tap");
      const purchaseResult = await purchaseRevenueCatPackage(
        selectedPlan.rcPackage,
        sessionUserId
      );
      const activated = await finalizePremiumActivation(
        purchaseResult.customerInfo,
        selectedPlan
      );

      if (!activated) {
        setIsPurchaseAccessUpdating(true);
        setScreenState("success");
        trackEvent("purchase_success", { activationPending: true });
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
    if (isBusy || !selectedPlan) {
      return;
    }

    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);
      const premiumAccess = hasPremiumAccess(customerInfo);

      if (!premiumAccess) {
        Alert.alert(NO_RESTORED_PURCHASE_TITLE, NO_RESTORED_PURCHASE_MESSAGE);
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

  if (screenState === "success") {
    return (
      <ActionSuccessScreen
        variant="payment"
        title={
          isPurchaseAccessUpdating ? PURCHASE_UPDATING_SUCCESS_TITLE : "You're Premium"
        }
        subtitle={
          isPurchaseAccessUpdating
            ? PURCHASE_UPDATING_SUCCESS_MESSAGE
            : lastPurchaseStore === "TEST_STORE"
            ? "Your premium access is ready. You can continue into Journal.IO."
            : "Your premium access is now active on this account."
        }
        buttonLabel="Continue"
        onPrimaryAction={handleContinueFromSuccess}
      />
    );
  }

  const colors = theme.colors;
  const showLoading = isLoadingPlans && !visiblePlans.length;

  const heroStyle = {
    opacity: heroAnim,
    transform: [
      { translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };
  const bulletsStyle = {
    opacity: bulletsAnim,
    transform: [
      {
        translateY: bulletsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
      },
    ],
  };
  const footerStyle = {
    opacity: footerAnim,
    transform: [
      { translateY: footerAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
    ],
  };

  return (
    <SafeAreaView
      edges={["top", "right", "left"]}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {ambientOrbFrame && !isOrbHandedOff ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ambientOrb,
            {
              // `ambientOrbFrame` is in window coordinates because that is what
              // the hand-off overlay needs; absolute children here are laid out
              // from the SafeAreaView's padding box, so undo its insets.
              left: ambientOrbFrame.x - insets.left,
              top: ambientOrbFrame.y - insets.top,
              opacity: Animated.multiply(heroAnim, ambientOrbOpacity),
            },
          ]}
        >
          <Orb
            deepColor={orbAccents.deep}
            primaryColor={colors.primary}
            secondaryColor={orbAccents.secondary}
            size={ambientOrbFrame.size}
            testID="paywall-ambient-orb"
          />
        </Animated.View>
      ) : null}

      <View style={styles.header}>
        <HapticPressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={handleDismiss}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <X size={18} color={colors.mutedForeground} />
        </HapticPressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight + 12 },
        ]}
      >
        <Animated.View style={[styles.hero, heroStyle]}>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            {copy.headline}
          </Text>
          <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
            {copy.subhead}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.bullets, bulletsStyle]}>
          <Text style={[styles.featuresLabel, { color: colors.mutedForeground }]}>
            What's included
          </Text>
          {copy.bullets.map(bullet => {
            return (
              <View key={bullet.text} style={styles.bulletRow}>
                <View
                  style={[
                    styles.bulletIcon,
                    { backgroundColor: `${colors.primary}1A` },
                  ]}
                >
                  <Image
                    accessibilityIgnoresInvertColors
                    source={bullet.icon}
                    style={styles.bulletIconImage}
                  />
                </View>
                <Text style={[styles.bulletText, { color: colors.foreground }]}>
                  {bullet.text}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </ScrollView>

      {/* Sticky footer: package cards + CTA. Pinned to the bottom; the scroll
          content is padded by its measured height so nothing overlaps.
          It reads as a sheet raised off the page, so the separation is carried
          by elevation rather than a fill tint. Tinted trays were tried first and
          both failed for the same reason: a neutral grey looked like a disabled
          strip, and a blush put a pink wash directly under a coral CTA and a
          coral-tinted selected card, collapsing the whole bottom third into one
          hue. A plain sheet leaves the coral as the only saturated thing down
          here. The unselected plan card drops to `background` to compensate —
          see `planCard`. */}
      <Animated.View
        onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
            shadowColor: PAYWALL_SHADOW_COLOR,
            shadowOpacity: footerShadowOpacity,
          },
          footerStyle,
        ]}
      >
        {showLoading ? (
          <View style={styles.footerLoading}>
            <JournalLoader color={colors.primary} />
          </View>
        ) : (
          <View style={styles.planRow}>
            {visiblePlans.map(plan => {
              const isSelected = plan.id === selectedPlan?.id;
              const introLabel = getIntroOfferLabel(plan.introOffer);
              const tag = introLabel || plan.badge || null;
              return (
                <Animated.View
                  key={plan.id}
                  style={[
                    styles.planCardWrap,
                    isSelected ? { transform: [{ scale: cardScale }] } : null,
                  ]}
                >
                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${getPlanName(plan)}, ${getPlanPriceLabel(
                      plan
                    )}${introLabel ? `, ${introLabel}` : ""}`}
                    onPress={() => handlePlanPress(plan)}
                    style={({ pressed }) => [
                      styles.planCard,
                      {
                        // `background`, not `card`: the footer is now a raised
                        // `card` sheet, so a `card` fill here would vanish into
                        // it. The selected card is a translucent primary wash
                        // and lifts off either surface unchanged.
                        backgroundColor: isSelected
                          ? `${colors.primary}12`
                          : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    {isSelected ? (
                      <View
                        style={[styles.planCheck, { backgroundColor: colors.primary }]}
                      >
                        <Check size={11} color={colors.primaryForeground} strokeWidth={3} />
                      </View>
                    ) : null}
                    <Text style={[styles.planName, { color: colors.foreground }]}>
                      {getPlanName(plan)}
                    </Text>
                    {/* Price and period are stacked, not concatenated: this card
                        is ~133pt wide on a 375pt screen, and a storefront can
                        hand back `Rp 1.499.000`. Giving the number the whole
                        line is what keeps it off a second one. */}
                    <PriceText
                      style={[styles.planPrice, { color: colors.foreground }]}
                      testID={`paywall-plan-price-${plan.id}`}
                      value={plan.price}
                    />
                    {plan.periodLabel ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.planPeriod, { color: colors.mutedForeground }]}
                      >
                        {plan.periodLabel}
                      </Text>
                    ) : null}
                    {plan.subtitle ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.planSubtitle, { color: colors.mutedForeground }]}
                      >
                        {plan.subtitle}
                      </Text>
                    ) : null}
                    {tag ? (
                      <View
                        style={[
                          styles.planTag,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : `${colors.primary}1A`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.planTagText,
                            {
                              color: isSelected
                                ? colors.primaryForeground
                                : colors.primary,
                            },
                          ]}
                        >
                          {tag}
                        </Text>
                      </View>
                    ) : null}
                  </HapticPressable>
                </Animated.View>
              );
            })}
          </View>
        )}

        {plansError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {plansError}
          </Text>
        ) : trialFootnote ? (
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            {trialFootnote}
          </Text>
        ) : null}

        <HapticPressable
          accessibilityLabel={ctaLabel}
          accessibilityRole="button"
          accessibilityState={{ busy: isProcessing, disabled: isBusy || !selectedPlan }}
          disabled={isBusy || !selectedPlan}
          onPress={() => handleUpgrade().catch(() => undefined)}
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: colors.primary },
            (pressed || isBusy) && styles.pressed,
          ]}
        >
          <ButtonLoadingContent
            loaderColor={colors.primaryForeground}
            loading={isProcessing}
          >
            <Animated.Text
              style={[
                styles.ctaText,
                { color: colors.primaryForeground, opacity: ctaFade },
              ]}
            >
              {ctaLabel}
            </Animated.Text>
          </ButtonLoadingContent>
        </HapticPressable>

        <View style={styles.footerRow}>
          <HapticPressable
            accessibilityLabel="Restore purchases"
            accessibilityRole="button"
            disabled={isBusy}
            hitSlop={8}
            onPress={() => handleRestore().catch(() => undefined)}
          >
            <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>
              {isRestoring ? "Restoring…" : "Restore"}
            </Text>
          </HapticPressable>
          <Text style={[styles.footerDot, { color: colors.mutedForeground }]}>·</Text>
          <HapticPressable
            accessibilityLabel="Terms of Service"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              openExternalUrl(LEGAL_URLS.termsOfService, "Terms of Service").catch(
                () => undefined
              )
            }
          >
            <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>
              Terms
            </Text>
          </HapticPressable>
          <Text style={[styles.footerDot, { color: colors.mutedForeground }]}>·</Text>
          <HapticPressable
            accessibilityLabel="Privacy Policy"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              openExternalUrl(LEGAL_URLS.privacyPolicy, "Privacy Policy").catch(
                () => undefined
              )
            }
          >
            <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>
              Privacy
            </Text>
          </HapticPressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  ambientOrb: {
    position: "absolute",
  },
  header: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  hero: {
    alignItems: "center",
    marginBottom: 36,
    marginTop: 6,
  },
  headline: {
    fontSize: 27,
    fontWeight: "700",
    letterSpacing: -0.6,
    lineHeight: 33,
    textAlign: "center",
  },
  subhead: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 320,
    textAlign: "center",
  },
  featuresLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  bullets: {
    gap: 14,
    marginBottom: 22,
  },
  bulletRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
  },
  bulletIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  bulletIconImage: {
    height: 20,
    resizeMode: "contain",
    width: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    lineHeight: 20,
  },
  footer: {
    // A full point, not a hairline: this line separates two close tones, and a
    // sub-pixel rule disappeared into them entirely.
    borderTopWidth: 1,
    bottom: 0,
    elevation: 12,
    left: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    position: "absolute",
    right: 0,
    // Cast upward, over the scrolling list — this is what lifts the sheet.
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 18,
  },
  footerLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 34,
  },
  planRow: {
    // `stretch` (the default) is load-bearing: it sizes both wrappers to the
    // taller card's content so the cards below can grow into a matched height.
    alignItems: "stretch",
    flexDirection: "row",
    gap: 12,
  },
  planCardWrap: {
    flex: 1,
  },
  planCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    // `flexGrow`, not `flex: 1`: `flex: 1` would also set `flexBasis: 0`, which
    // drops this card's content out of the height calculation and collapses the
    // row back to `minHeight`. Growing from an `auto` basis is what lets the
    // shorter card fill the taller one — only the yearly card carries an intro
    // tag, so without this the two cards differ by a tag's height.
    flexGrow: 1,
    justifyContent: "center",
    // `minHeight`, not `height`: a price long enough to survive shrink-to-fit
    // used to spill out of a fixed card.
    minHeight: 118,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: "100%",
  },
  planCheck: {
    alignItems: "center",
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 14,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 22,
  },
  planName: {
    fontSize: 14,
    fontWeight: "600",
  },
  planPrice: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 3,
    // Full card width, so shrink-to-fit measures against the card rather than
    // the natural width of the string.
    textAlign: "center",
    width: "100%",
  },
  planPeriod: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
    textAlign: "center",
  },
  planSubtitle: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
    textAlign: "center",
  },
  planTag: {
    borderRadius: 6,
    marginTop: 6,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planTagText: {
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 12,
    textAlign: "center",
  },
  footnote: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 12,
    textAlign: "center",
  },
  ctaButton: {
    alignItems: "center",
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 56,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
  },
  footerLink: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  footerDot: {
    fontSize: 12.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
