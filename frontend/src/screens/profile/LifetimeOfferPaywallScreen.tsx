import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
} from "react-native-purchases";
import { ArrowRight, CheckCircle2, Crown, RefreshCcw, Sparkles, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../../components/PrimaryButton";
import {
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatCustomerInfo,
  getRevenueCatOfferings,
  getRevenueCatPaywallPlans,
  hasRevenueCatPremiumAccess,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  type RevenueCatPaywallPlan,
} from "../../services/revenueCatService";
import {
  getPaywallConfig,
  syncPaywallPurchase,
  trackPaywallEvent,
  type PaywallFeatureCard,
  type PaywallOffering,
  type ResolvedPaywallConfig,
} from "../../services/paywallService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";

const mascotImage = require("../../assets/png/Masscott.png");

type SubscriptionPlanKey = "weekly" | "monthly" | "yearly" | "lifetime" | null | undefined;

type LifetimeOfferPaywallScreenProps = {
  onBack: () => void;
  currentPlanKey?: SubscriptionPlanKey;
};

type LifetimePlan = {
  id: string;
  title: string;
  durationLabel: string;
  price: string;
  subtitle: string;
  highlight?: string;
  badge?: string;
  offeringKey: "lifetime";
  revenueCatOfferingId: string | null;
  revenueCatPackageId: string | null;
  rcPackage: RevenueCatPaywallPlan["rcPackage"];
};

type OfferPreviewCard = {
  id: string;
  title: string;
  body: string;
  footer: string;
};

const DEFAULT_TEMPLATE = {
  title: "Lifetime Offer",
  headline: "A one-time premium unlock for the first 100 Journal.IO members.",
  subheadline: "Reserve lifetime premium access while the launch offer is still available.",
  heroBadgeLabel: "Lifetime access",
  purchaseChipTitle: "One-time",
  purchaseChipBody: "No renewal",
  featureCarouselTitle: "What lifetime unlocks",
  socialProofLine: "Be one of the first users to be part of this family.",
  footerLegal: "One-time purchase. Premium stays on this account after sync.",
  featureList: [
    {
      title: "A calmer premium path",
      body: "Keep AI insights, prompt support, and deeper review tools available whenever you come back to journal.",
      footer: "No weekly or yearly plan switching required.",
    },
    {
      title: "Built for a longer journaling rhythm",
      body: "Lifetime access fits the users who want Journal.IO to stay in the background for months, not just one billing cycle.",
      footer: "One purchase. Ongoing access.",
    },
    {
      title: "Lifetime-offer positioning",
      body: "This screen is intentionally more expressive than the standard paywall so the lifetime offer feels distinct and worth stopping for.",
      footer: "Still calm, just more premium.",
    },
  ] satisfies PaywallFeatureCard[],
};

const DEFAULT_LIFETIME_OFFERING: PaywallOffering = {
  key: "lifetime",
  title: "LIFETIME",
  price: "$200",
  priceSuffix: "one-time",
  subtitle: "One-time unlock",
  badge: "One time offer",
  highlight: "First 100 users",
  sortOrder: 0,
  revenueCatOfferingId: "journalio_offering_dev",
  revenueCatPackageId: "$rc_lifetime",
  purchasedUsersCount: 0,
  purchaseLimit: 100,
};

const SWIPE_RAIL_HEIGHT = 64;
const SWIPE_THUMB_INSET_COMPACT = 6;
const SWIPE_THUMB_INSET_REGULAR = 7;

const isPurchasesError = (error: unknown): error is PurchasesError =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  "message" in error;

const getPurchaseErrorMessage = (error: unknown) => {
  if (!isPurchasesError(error)) {
    return error instanceof Error
      ? error.message
      : "We could not complete that purchase right now. Please try again.";
  }

  if (
    error.code === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
    error.code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR
  ) {
    return "The purchase could not reach RevenueCat right now. Check your connection and try again.";
  }

  if (error.code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR) {
    return "RevenueCat is configured, but the selected lifetime package is not ready yet.";
  }

  if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return "This payment is pending. RevenueCat will update the entitlement when the store confirms it.";
  }

  return error.message;
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

const buildPreviewCards = (
  paywallConfig: ResolvedPaywallConfig | null
): OfferPreviewCard[] => {
  const featureList =
    paywallConfig?.template?.featureList?.length
      ? paywallConfig.template.featureList
      : DEFAULT_TEMPLATE.featureList;

  return featureList.slice(0, 3).map((feature, index) => ({
    id: `lifetime-preview-${index}`,
    title: feature.title,
    body: feature.body,
    footer: feature.footer || "Premium tools that stay close to your journaling rhythm.",
  }));
};

const buildFallbackPlan = (): LifetimePlan => ({
  id: "lifetime",
  title: DEFAULT_LIFETIME_OFFERING.title,
  durationLabel: DEFAULT_LIFETIME_OFFERING.price,
  price: `${DEFAULT_LIFETIME_OFFERING.price} one-time`,
  subtitle: DEFAULT_LIFETIME_OFFERING.subtitle || "One-time unlock",
  highlight: DEFAULT_LIFETIME_OFFERING.highlight || undefined,
  badge: DEFAULT_LIFETIME_OFFERING.badge || undefined,
  offeringKey: "lifetime",
  revenueCatOfferingId: DEFAULT_LIFETIME_OFFERING.revenueCatOfferingId,
  revenueCatPackageId: DEFAULT_LIFETIME_OFFERING.revenueCatPackageId,
  rcPackage: null,
});

export default function LifetimeOfferPaywallScreen({
  onBack,
  currentPlanKey,
}: LifetimeOfferPaywallScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const horizontalPadding = isCompact ? 16 : width >= 430 ? 26 : 22;
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const sessionUserName = useAppStore(state => state.session?.user.name || "you");
  const setSessionPremiumStatus = useAppStore(state => state.setSessionPremiumStatus);
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const [paywallConfig, setPaywallConfig] = useState<ResolvedPaywallConfig | null>(
    null
  );
  const [plan, setPlan] = useState<LifetimePlan>(buildFallbackPlan);
  const [plansError, setPlansError] = useState<string | null>(
    getRevenueCatConfigurationError()
  );
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [screenState, setScreenState] = useState<"offer" | "success">("offer");
  const [lastPurchaseStore, setLastPurchaseStore] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const swipeTranslate = useRef(new Animated.Value(0)).current;
  const swipeTriggeredRef = useRef(false);
  const mascotFloat = useRef(new Animated.Value(0)).current;
  const haloPulse = useRef(new Animated.Value(0)).current;
  const orbitSpin = useRef(new Animated.Value(0)).current;
  const chipDrift = useRef(new Animated.Value(0)).current;
  const backgroundDrift = useRef(new Animated.Value(0)).current;
  const previewTransition = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const previewCards = useMemo(
    () => buildPreviewCards(paywallConfig),
    [paywallConfig]
  );
  const activePreviewCard = previewCards[previewIndex] ?? previewCards[0];
  const heroTitle = paywallConfig?.template?.title || DEFAULT_TEMPLATE.title;
  const heroBadgeLabel =
    paywallConfig?.template?.heroBadgeLabel || DEFAULT_TEMPLATE.heroBadgeLabel;
  const lifetimeOffering =
    paywallConfig?.offerings.find(offering => offering.key === "lifetime") ||
    DEFAULT_LIFETIME_OFFERING;
  const purchaseChipTitle =
    paywallConfig?.template?.purchaseChipTitle || DEFAULT_TEMPLATE.purchaseChipTitle;
  const purchaseChipBody =
    paywallConfig?.template?.purchaseChipBody || DEFAULT_TEMPLATE.purchaseChipBody;
  const featureCarouselTitle =
    paywallConfig?.template?.featureCarouselTitle ||
    DEFAULT_TEMPLATE.featureCarouselTitle;
  const socialProofLine =
    paywallConfig?.template?.socialProofLine || DEFAULT_TEMPLATE.socialProofLine;
  const footerLegalCopy =
    paywallConfig?.template?.footerLegal || DEFAULT_TEMPLATE.footerLegal;
  const isBusy = isProcessing || isRestoring;
  const canPurchase = Boolean(plan.rcPackage) && currentPlanKey !== "lifetime";
  const swipeThumbInset = isCompact
    ? SWIPE_THUMB_INSET_COMPACT
    : SWIPE_THUMB_INSET_REGULAR;
  const swipeThumbSize = SWIPE_RAIL_HEIGHT - swipeThumbInset * 2;
  const swipeThumbTopOffset = Math.max((SWIPE_RAIL_HEIGHT - swipeThumbSize) / 2, 0);
  const swipeTrackWidth = width - horizontalPadding * 2;
  const swipeMaxDistance = Math.max(swipeTrackWidth - swipeThumbSize - 10, 0);
  const swipeThreshold = swipeMaxDistance * 0.7;
  const footerBottomPadding = 0;
  const footerReservedSpace = 126;
  const successTags =
    lastPurchaseStore === "TEST_STORE"
      ? ["RevenueCat test", "Lifetime access"]
      : ["Lifetime access", "Premium active"];
  const footerCtaLabel =
    currentPlanKey === "lifetime"
      ? "Lifetime already active"
      : isProcessing
        ? "Claiming lifetime access..."
        : isLoadingPlan
          ? "Loading offer..."
        : "Claim Lifetime Access";
  const lifetimePurchaseLimit =
    lifetimeOffering.purchaseLimit ?? DEFAULT_LIFETIME_OFFERING.purchaseLimit;
  const lifetimeMembersCopy = lifetimePurchaseLimit
    ? `${lifetimeOffering.purchasedUsersCount}/${lifetimePurchaseLimit} users claimed lifetime access.`
    : `${lifetimeOffering.purchasedUsersCount} users claimed lifetime access.`;

  const trackLifetimeEvent = useCallback(
    (
      eventType:
        | "paywall_impression"
        | "plan_select"
        | "cta_tap"
        | "purchase_success"
        | "restore_success"
        | "purchase_failure",
      metadata?: Record<string, unknown>
    ) => {
      if (!paywallConfig?.template) {
        return Promise.resolve(null);
      }

      return trackPaywallEvent({
        placementKey: paywallConfig.placementKey,
        screenKey: "profile",
        eventType,
        templateKey: paywallConfig.template.key,
        offeringKey: "lifetime",
        wasInterruptive: paywallConfig.wasInterruptive,
        metadata: {
          previewEntry: "profile_dev_button",
          ...metadata,
        },
      }).catch(() => null);
    },
    [paywallConfig]
  );

  useEffect(() => {
    let isMounted = true;

    const loadLifetimeOffer = async () => {
      setPlansError(getRevenueCatConfigurationError());
      setIsLoadingPlan(true);

      try {
        const resolvedConfig = sessionUserId
          ? await getPaywallConfig({
              placementKey: "profile_upgrade_banner",
              screenKey: "profile",
            })
          : null;

        if (!isMounted) {
          return;
        }

        const configToUse =
          resolvedConfig?.template?.key === "lifetime-launch" ? resolvedConfig : null;

        if (configToUse) {
          setPaywallConfig(configToUse);
        }

        const offerings = await getRevenueCatOfferings(sessionUserId);

        if (!isMounted) {
          return;
        }

        const configuredLifetimeOfferings = configToUse?.offerings.filter(
          offering => offering.key === "lifetime"
        ) || [DEFAULT_LIFETIME_OFFERING];
        const resolvedPlan = getRevenueCatPaywallPlans(
          offerings,
          configuredLifetimeOfferings
        ).find(candidate => candidate.planKey === "lifetime");

        if (!resolvedPlan) {
          setPlan(buildFallbackPlan());
          setPlansError(
            previous =>
              previous ||
              "The lifetime offer preview loaded, but its live RevenueCat package is not available yet."
          );
          return;
        }

        setPlan({
          id: resolvedPlan.id,
          title: resolvedPlan.title,
          durationLabel: resolvedPlan.durationLabel,
          price: resolvedPlan.price,
          subtitle: resolvedPlan.subtitle,
          highlight: resolvedPlan.highlight,
          badge: configuredLifetimeOfferings[0]?.badge || resolvedPlan.badge,
          offeringKey: "lifetime",
          revenueCatOfferingId:
            configuredLifetimeOfferings[0]?.revenueCatOfferingId || null,
          revenueCatPackageId:
            configuredLifetimeOfferings[0]?.revenueCatPackageId || null,
          rcPackage: resolvedPlan.rcPackage,
        });
        setPlansError(
          resolvedPlan.rcPackage
            ? null
            : "The lifetime offer preview is visible, but its live RevenueCat package is not available yet."
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPlan(buildFallbackPlan());
        setPlansError(
          error instanceof Error
            ? error.message
            : "We could not load the lifetime offer right now."
        );
      } finally {
        if (isMounted) {
          setIsLoadingPlan(false);
        }
      }
    };

    loadLifetimeOffer().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [sessionUserId]);

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(mascotFloat, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(mascotFloat, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(haloPulse, {
            toValue: 1,
            duration: 1700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(haloPulse, {
            toValue: 0,
            duration: 1700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.timing(orbitSpin, {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(chipDrift, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(chipDrift, {
            toValue: 0,
            duration: 2400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundDrift, {
            toValue: 1,
            duration: 3200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(backgroundDrift, {
            toValue: 0,
            duration: 3200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    loops.forEach(loop => loop.start());

    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [
    backgroundDrift,
    chipDrift,
    contentAnim,
    footerAnim,
    haloPulse,
    headerAnim,
    heroAnim,
    mascotFloat,
    orbitSpin,
  ]);

  useEffect(() => {
    if (!paywallConfig?.template) {
      return;
    }

    trackLifetimeEvent("paywall_impression");
  }, [paywallConfig, trackLifetimeEvent]);

  useEffect(() => {
    if (previewCards.length < 2) {
      return;
    }

    const intervalId = setInterval(() => {
      setPreviewIndex(previous => (previous + 1) % previewCards.length);
    }, 2600);

    return () => {
      clearInterval(intervalId);
    };
  }, [previewCards.length]);

  useEffect(() => {
    previewTransition.stopAnimation();
    previewTransition.setValue(0);
    Animated.timing(previewTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activePreviewCard, previewTransition]);

  useEffect(() => {
    if (screenState !== "success") {
      return;
    }

    successAnim.setValue(0);
    Animated.timing(successAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenState, successAnim]);

  const completePremiumActivation = useCallback(
    async (customerInfo: CustomerInfo, options: { wasRestore?: boolean } = {}) => {
      const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);
      const hasPremiumAccess = hasRevenueCatPremiumAccess(customerInfo);

      setLastPurchaseStore(activeEntitlement?.store ?? null);

      if (!hasPremiumAccess) {
        return false;
      }

      const updatedProfile = await syncPaywallPurchase({
        offeringKey: "lifetime",
        revenueCatOfferingId:
          plan.revenueCatOfferingId ||
          DEFAULT_LIFETIME_OFFERING.revenueCatOfferingId ||
          "unknown",
        revenueCatPackageId:
          plan.revenueCatPackageId ||
          plan.rcPackage?.identifier ||
          DEFAULT_LIFETIME_OFFERING.revenueCatPackageId ||
          "unknown",
        store: activeEntitlement?.store || "unknown",
        entitlementId: activeEntitlement?.identifier || "unknown",
        wasRestore: Boolean(options.wasRestore),
      });

      setSessionUserProfile(updatedProfile);
      setScreenState("success");
      return true;
    },
    [plan.rcPackage?.identifier, plan.revenueCatOfferingId, plan.revenueCatPackageId, setSessionUserProfile]
  );

  const finalizePremiumActivation = useCallback(
    async (customerInfo: CustomerInfo, options: { wasRestore?: boolean } = {}) => {
      const activated = await completePremiumActivation(customerInfo, options);

      if (activated || !sessionUserId) {
        return activated;
      }

      const refreshedCustomerInfo = await getRevenueCatCustomerInfo(sessionUserId);

      if (!refreshedCustomerInfo) {
        return false;
      }

      return completePremiumActivation(refreshedCustomerInfo, options);
    },
    [completePremiumActivation, sessionUserId]
  );

  const resetSwipe = useCallback(() => {
    Animated.spring(swipeTranslate, {
      toValue: 0,
      // The swipe rail fill animates width, so this value must stay on the JS driver.
      useNativeDriver: false,
      bounciness: 0,
      speed: 18,
    }).start();
  }, [swipeTranslate]);

  const handlePurchase = useCallback(async () => {
    if (currentPlanKey === "lifetime") {
      Alert.alert(
        "Lifetime already active",
        "This account already has lifetime access."
      );
      resetSwipe();
      return;
    }

    if (!plan.rcPackage) {
      Alert.alert(
        "Offer unavailable",
        "This lifetime preview loaded, but the live purchase package is not available yet."
      );
      resetSwipe();
      return;
    }

    let purchaseCompleted = false;
    setIsProcessing(true);
    await trackLifetimeEvent("cta_tap");

    try {
      const result = await purchaseRevenueCatPackage(plan.rcPackage, sessionUserId);
      const activated = await finalizePremiumActivation(result.customerInfo);

      if (!activated) {
        await setSessionPremiumStatus(true);
        setScreenState("success");
      }

      purchaseCompleted = true;

      await trackLifetimeEvent("purchase_success", {
        store: getRevenueCatActiveEntitlement(result.customerInfo)?.store || "unknown",
      });
    } catch (error) {
      await trackLifetimeEvent("purchase_failure", {
        message: getPurchaseErrorMessage(error),
      });
      Alert.alert("Purchase failed", getPurchaseErrorMessage(error));
    } finally {
      setIsProcessing(false);
      swipeTriggeredRef.current = false;

      if (!purchaseCompleted) {
        resetSwipe();
      }
    }
  }, [
    currentPlanKey,
    finalizePremiumActivation,
    plan.rcPackage,
    resetSwipe,
    sessionUserId,
    setSessionPremiumStatus,
    trackLifetimeEvent,
  ]);

  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);
      const activated = await finalizePremiumActivation(customerInfo, {
        wasRestore: true,
      });

      if (!activated) {
        Alert.alert(
          "No active purchase found",
          "RevenueCat did not return an active premium entitlement for this account."
        );
        return;
      }

      await trackLifetimeEvent("restore_success", {
        store: getRevenueCatActiveEntitlement(customerInfo)?.store || "unknown",
      });
    } catch (error) {
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

  const swipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          canPurchase &&
          !isLoadingPlan &&
          !isRestoring &&
          !isProcessing &&
          Math.abs(gestureState.dx) > 6 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          const clampedDx = Math.max(0, Math.min(gestureState.dx, swipeMaxDistance));
          swipeTranslate.setValue(clampedDx);
        },
        onPanResponderRelease: (_, gestureState) => {
          const clampedDx = Math.max(0, Math.min(gestureState.dx, swipeMaxDistance));

          if (clampedDx >= swipeThreshold && !swipeTriggeredRef.current) {
            swipeTriggeredRef.current = true;

            Animated.timing(swipeTranslate, {
              toValue: swipeMaxDistance,
              duration: 120,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }).start(({ finished }) => {
              if (finished) {
                handlePurchase().catch(() => undefined);
              } else {
                swipeTriggeredRef.current = false;
                resetSwipe();
              }
            });

            return;
          }

          resetSwipe();
        },
        onPanResponderTerminate: () => {
          resetSwipe();
        },
      }),
    [
      canPurchase,
      handlePurchase,
      isLoadingPlan,
      isProcessing,
      isRestoring,
      resetSwipe,
      swipeMaxDistance,
      swipeThreshold,
      swipeTranslate,
    ]
  );

  const headerTranslate = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 0],
  });
  const heroTranslate = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const contentTranslate = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 0],
  });
  const footerTranslate = footerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  const swipeFillWidth = swipeTranslate.interpolate({
    inputRange: [0, swipeMaxDistance || 1],
    outputRange: [swipeThumbSize + 10, swipeMaxDistance + swipeThumbSize + 10],
    extrapolate: "clamp",
  });
  const mascotTranslate = mascotFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const haloScale = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const haloOpacity = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.62],
  });
  const orbitRotation = orbitSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const chipLift = chipDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const backgroundLift = backgroundDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });
  const previewTranslate = previewTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const successTranslate = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  if (screenState === "success") {
    return (
      <SafeAreaView
        edges={["top", "right", "bottom", "left"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.successContainer}>
          <Animated.View
            style={[
              styles.successCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: successAnim,
                transform: [{ translateY: successTranslate }],
              },
            ]}
          >
            <View
              style={[
                styles.successIconWrap,
                { backgroundColor: hexToRgba(theme.colors.primary, 0.14) },
              ]}
            >
              <CheckCircle2 size={26} color={theme.colors.primary} />
            </View>
            <Text style={[styles.successTitle, { color: theme.colors.foreground }]}>
              Lifetime access is active.
            </Text>
            <Text style={[styles.successBody, { color: theme.colors.mutedForeground }]}>
              Journal.IO now has permanent premium access on this account for {sessionUserName}.
            </Text>
            <View style={styles.successTagRow}>
              {successTags.map(tag => (
                <View
                  key={tag}
                  style={[
                    styles.successTag,
                    { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
                  ]}
                >
                  <Sparkles size={12} color={theme.colors.primary} />
                  <Text style={[styles.successTagText, { color: theme.colors.foreground }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
            <PrimaryButton
              label="Return to Subscription"
              onPress={onBack}
              tone="accent"
              icon={<ArrowRight size={16} color={theme.colors.primaryForeground} />}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "right", "bottom", "left"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backgroundBubbleTop,
            {
              backgroundColor: hexToRgba(theme.colors.primary, 0.12),
              transform: [{ translateY: backgroundLift }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backgroundBubbleMiddle,
            {
              backgroundColor: hexToRgba(theme.colors.info, 0.09),
              transform: [{ translateY: backgroundLift }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backgroundBubbleBottom,
            {
              backgroundColor: hexToRgba(theme.colors.warning, 0.08),
              transform: [{ translateY: backgroundLift }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.header,
            {
              paddingHorizontal: horizontalPadding,
              opacity: headerAnim,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close lifetime offer preview"
            onPress={onBack}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: hexToRgba(theme.colors.foreground, 0.08),
                borderColor: hexToRgba(theme.colors.foreground, 0.08),
              },
              pressed && styles.pressed,
            ]}
          >
            <X size={18} color={theme.colors.foreground} />
          </Pressable>
        </Animated.View>

        <View style={styles.viewport}>
          <Animated.View
            style={[
              styles.mainContent,
              {
                paddingHorizontal: horizontalPadding,
                paddingBottom: footerReservedSpace,
                opacity: heroAnim,
                transform: [{ translateY: heroTranslate }],
              },
            ]}
          >
            <View
              style={[
                styles.offerCard,
                {
                  backgroundColor: hexToRgba(theme.colors.card, 0.9),
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroCopy}>
                  <View
                    style={[
                      styles.heroBadge,
                      { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
                    ]}
                  >
                    <Crown size={14} color={theme.colors.primary} />
                    <Text style={[styles.heroBadgeText, { color: theme.colors.primary }]}>
                      {heroBadgeLabel}
                    </Text>
                  </View>

                  <Text style={[styles.heroTitle, { color: theme.colors.foreground }]}>
                    {heroTitle}
                  </Text>
                </View>

                <View style={styles.mascotStage}>
                  <Animated.View
                    style={[
                      styles.orbitRing,
                      {
                        borderColor: hexToRgba(theme.colors.primary, 0.16),
                        transform: [{ rotate: orbitRotation }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.mascotHalo,
                      {
                        backgroundColor: hexToRgba(theme.colors.primary, 0.22),
                        opacity: haloOpacity,
                        transform: [{ scale: haloScale }],
                      },
                    ]}
                  />
                  <Animated.Image
                    source={mascotImage}
                    resizeMode="contain"
                    style={[
                      styles.mascot,
                      {
                        transform: [{ translateY: mascotTranslate }],
                      },
                    ]}
                  />

                  <Animated.View
                    style={[
                      styles.floatingChip,
                      styles.floatingChipLeft,
                      {
                        backgroundColor: hexToRgba(theme.colors.background, 0.94),
                        borderColor: hexToRgba(theme.colors.primary, 0.16),
                        transform: [{ translateY: chipLift }],
                      },
                    ]}
                  >
                    <Text style={[styles.floatingChipTitle, { color: theme.colors.foreground }]}>
                      {purchaseChipTitle}
                    </Text>
                    <Text
                      style={[styles.floatingChipBody, { color: theme.colors.mutedForeground }]}
                    >
                      {purchaseChipBody}
                    </Text>
                  </Animated.View>

                </View>
              </View>

              <View
                style={[
                  styles.priceCard,
                  {
                    borderColor: hexToRgba(theme.colors.border, 0.75),
                  },
                ]}
              >
                <View style={styles.priceCardHeader}>
                  <View style={styles.priceLabelBlock}>
                    <Text style={[styles.priceValue, { color: theme.colors.foreground }]}>
                      {plan.durationLabel}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.offerBadge,
                      styles.offerBadgeCompact,
                      { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
                    ]}
                  >
                    <Text style={[styles.offerBadgeText, { color: theme.colors.primary }]}>
                      {plan.badge || "Lifetime"}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceSupportBlock}>
                  <View
                    style={[
                      styles.priceTrackerPill,
                      {
                        backgroundColor: hexToRgba(theme.colors.success, 0.18),
                        borderColor: hexToRgba(theme.colors.success, 0.34),
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.priceTrackerText,
                        { color: theme.colors.success },
                      ]}
                    >
                      {lifetimeMembersCopy}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.priceSupportText, { color: theme.colors.mutedForeground }]}
                  >
                    {socialProofLine}
                  </Text>
                </View>
              </View>
            </View>

            <Animated.View
              style={[
                styles.contentBlock,
                {
                  opacity: contentAnim,
                  transform: [{ translateY: contentTranslate }],
                },
              ]}
            >
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    styles.featureShowcaseTitle,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {featureCarouselTitle}
                </Text>

                <View
                  style={[
                    styles.previewStage,
                    {
                      backgroundColor: hexToRgba(theme.colors.primary, 0.06),
                      borderColor: hexToRgba(theme.colors.primary, 0.14),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.previewStageAccent,
                      { backgroundColor: hexToRgba(theme.colors.primary, 0.18) },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.featureSlide,
                      {
                        opacity: previewTransition,
                        transform: [{ translateX: previewTranslate }],
                      },
                    ]}
                  >
                    <Text style={[styles.previewTitle, { color: theme.colors.foreground }]}>
                      {activePreviewCard.title}
                    </Text>
                    <Text
                      style={[styles.previewBody, { color: theme.colors.foreground }]}
                      numberOfLines={3}
                    >
                      {activePreviewCard.body}
                    </Text>
                    <Text
                      style={[styles.previewFooter, { color: theme.colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {activePreviewCard.footer}
                    </Text>
                  </Animated.View>
                </View>

                <View style={styles.dotRow}>
                  {previewCards.map((_, index) => (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`Open lifetime preview card ${index + 1}`}
                      onPress={() => setPreviewIndex(index)}
                      style={[
                        styles.dot,
                        index === previewIndex
                          ? [styles.dotActive, { backgroundColor: theme.colors.primary }]
                          : {
                              backgroundColor: hexToRgba(
                                theme.colors.foreground,
                                0.18
                              ),
                            },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.footer,
              {
                backgroundColor: hexToRgba(theme.colors.background, 0.98),
                borderTopColor: theme.colors.border,
                paddingHorizontal: horizontalPadding,
                paddingBottom: footerBottomPadding,
                opacity: footerAnim,
                transform: [{ translateY: footerTranslate }],
              },
            ]}
          >
            {plansError ? (
              <Text style={[styles.footerError, { color: theme.colors.warning }]}>
                {plansError}
              </Text>
            ) : null}

            <View
              style={[
                styles.swipeRail,
                {
                  backgroundColor: hexToRgba(theme.colors.primary, 0.78),
                },
                !canPurchase || isLoadingPlan ? styles.swipeRailDisabled : null,
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.swipeFill,
                  {
                    width: swipeFillWidth,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
              <Text
                style={[
                  styles.swipeRailText,
                  { color: theme.colors.primaryForeground },
                ]}
              >
                {footerCtaLabel === "Claim Lifetime Access"
                  ? "Swipe to unlock lifetime access"
                  : footerCtaLabel}
              </Text>

              <Animated.View
                {...swipePanResponder.panHandlers}
                style={[
                  styles.swipeThumb,
                  {
                    width: swipeThumbSize,
                    height: swipeThumbSize,
                    top: swipeThumbTopOffset,
                    backgroundColor: theme.colors.primaryForeground,
                    transform: [{ translateX: swipeTranslate }],
                  },
                ]}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <ArrowRight size={18} color={theme.colors.primary} />
                )}
              </Animated.View>
            </View>

            <View style={styles.footerActionRow}>
              <Text style={[styles.footerLegal, { color: theme.colors.mutedForeground }]}>
                {footerLegalCopy}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restore purchases"
                onPress={handleRestore}
                disabled={isBusy || isLoadingPlan}
                style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <RefreshCcw size={15} color={theme.colors.primary} />
                    <Text style={[styles.restoreText, { color: theme.colors.primary }]}>
                      Restore Purchases
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </View>
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
  successContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  successCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  successIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  successBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  successTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  successTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  successTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  backgroundBubbleTop: {
    position: "absolute",
    top: 88,
    right: -22,
    width: 196,
    height: 196,
    borderRadius: 196,
  },
  backgroundBubbleMiddle: {
    position: "absolute",
    top: 340,
    left: -44,
    width: 178,
    height: 178,
    borderRadius: 178,
  },
  backgroundBubbleBottom: {
    position: "absolute",
    bottom: 160,
    right: -56,
    width: 220,
    height: 220,
    borderRadius: 220,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewport: {
    flex: 1,
    justifyContent: "space-between",
    gap: 10,
  },
  mainContent: {
    flex: 1,
    gap: 10,
  },
  offerCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  mascotStage: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 138,
    width: 132,
  },
  orbitRing: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 128,
    borderWidth: 1,
  },
  mascotHalo: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 108,
  },
  mascot: {
    width: 94,
    height: 94,
  },
  floatingChip: {
    position: "absolute",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 82,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 1,
  },
  floatingChipLeft: {
    left: -4,
    bottom: 16,
  },
  floatingChipTitle: {
    fontSize: 10,
    fontWeight: "700",
  },
  floatingChipBody: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
  },
  contentBlock: {
    gap: 8,
  },
  priceCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  priceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceLabelBlock: {
    flex: 1,
    gap: 0,
  },
  priceValue: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -1,
  },
  priceSupportBlock: {
    marginTop: 8,
    alignItems: "center",
    gap: 2,
  },
  priceTrackerPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  priceTrackerText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  priceSupportText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  offerBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offerBadgeCompact: {
    alignSelf: "flex-start",
  },
  offerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  featureShowcaseTitle: {
    textAlign: "center",
    fontSize: 17,
  },
  previewStage: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: "hidden",
  },
  previewStageAccent: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  featureSlide: {
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  previewTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.45,
  },
  previewBody: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
  },
  previewFooter: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dotActive: {
    width: 20,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  footerError: {
    fontSize: 12,
    lineHeight: 18,
  },
  swipeRail: {
    borderRadius: 18,
    height: SWIPE_RAIL_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 12,
  },
  swipeFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
  },
  swipeRailDisabled: {
    opacity: 0.72,
  },
  swipeRailText: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 68,
  },
  swipeThumb: {
    position: "absolute",
    left: 5,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  footerActionRow: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 24,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footerLegal: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
