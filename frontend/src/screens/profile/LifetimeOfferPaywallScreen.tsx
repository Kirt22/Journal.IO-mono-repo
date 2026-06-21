import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOfferings,
} from "react-native-purchases";
import {
  BarChart3,
  Brain,
  Check,
  Crown,
  Download,
  Sparkles,
  Star,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActionSuccessScreen from "../../components/ActionSuccessScreen";
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
  type RevenueCatPaywallPlan,
} from "../../services/revenueCatService";
import {
  getPaywallConfig,
  isRetryableEntitlementSyncError,
  syncPaywallPurchase,
  trackPaywallEvent,
  type PaywallOffering,
  type ResolvedPaywallConfig,
} from "../../services/paywallService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import {
  getPurchaseErrorMessage,
  isPurchasesError,
  NO_RESTORED_PURCHASE_MESSAGE,
  NO_RESTORED_PURCHASE_TITLE,
  PURCHASE_UPDATING_SUCCESS_MESSAGE,
  PURCHASE_UPDATING_SUCCESS_TITLE,
} from "./paywallShared";

type SubscriptionPlanKey = "weekly" | "monthly" | "yearly" | "lifetime" | null | undefined;

type LifetimeOfferPaywallScreenProps = {
  onBack: () => void;
  currentPlanKey?: SubscriptionPlanKey;
};

type LifetimeScreenPlan = RevenueCatPaywallPlan;

type FeatureRow = {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
};

type Testimonial = {
  name: string;
  quote: string;
};

const DEFAULT_LIFETIME_OFFERING: PaywallOffering = {
  key: "lifetime",
  title: "LIFETIME",
  price: null,
  priceSuffix: "one-time",
  subtitle: "One-time unlock",
  badge: "One time offer",
  highlight: "First 100 users",
  sortOrder: 0,
  revenueCatOfferingId: "journalio_offering_lifetime",
  revenueCatPackageId: null,
  purchasedUsersCount: 0,
  purchaseLimit: 100,
};

const LIFETIME_BADGE = "LIMITED";
const LIFETIME_LOADER_COPY = "Loading lifetime offer...";

const FEATURE_ROWS: FeatureRow[] = [
  {
    icon: Brain,
    title: "Unlimited AI insights & personalised prompts",
  },
  {
    icon: BarChart3,
    title: "Advanced analytics & emotion tracking",
  },
  {
    icon: Download,
    title: "Securely export all your entries",
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sarah M.",
    quote: '"Best investment for my mental health."',
  },
  {
    name: "James K.",
    quote: '"I journal every day now. Worth every penny."',
  },
  {
    name: "Priya R.",
    quote: '"The AI insights changed how I see myself."',
  },
];

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

function buildFallbackPlan(
  configuredOffering: PaywallOffering = DEFAULT_LIFETIME_OFFERING
): LifetimeScreenPlan {
  return {
    id: "lifetime",
    title: configuredOffering.title,
    durationLabel: "",
    price: "",
    subtitle: configuredOffering.subtitle ?? "One-time unlock",
    highlight: configuredOffering.highlight ?? undefined,
    badge: configuredOffering.badge ?? undefined,
    revenueCatOfferingId: configuredOffering.revenueCatOfferingId,
    revenueCatPackageId: configuredOffering.revenueCatPackageId,
    rcPackage: null,
    planKey: "lifetime",
    introOffer: null,
  };
}

function FeatureItem({
  icon: Icon,
  title,
  accentColor,
  iconColor,
  textColor,
  containerStyle,
}: {
  icon: FeatureRow["icon"];
  title: string;
  accentColor: string;
  iconColor: string;
  textColor: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.featureRow, containerStyle]}>
      <View style={[styles.featureIconWrap, { backgroundColor: accentColor }]}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <Text style={[styles.featureTitle, { color: textColor }]}>{title}</Text>
    </View>
  );
}

export default function LifetimeOfferPaywallScreen({
  onBack,
  currentPlanKey,
}: LifetimeOfferPaywallScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const sessionUserName = useAppStore(state => state.session?.user.name || "you");
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const [plan, setPlan] = useState<LifetimeScreenPlan>(buildFallbackPlan);
  const [revenueCatOfferings, setRevenueCatOfferings] =
    useState<PurchasesOfferings | null>(null);
  const [paywallConfig, setPaywallConfig] = useState<ResolvedPaywallConfig | null>(
    null
  );
  const [plansError, setPlansError] = useState<string | null>(
    getRevenueCatConfigurationError()
  );
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [screenState, setScreenState] = useState<"offer" | "success">("offer");
  const [isPurchaseAccessUpdating, setIsPurchaseAccessUpdating] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const palette = theme.colors;
  const isCompact = width < 380;
  const horizontalPadding = isCompact ? 20 : width >= 430 ? 28 : 22;
  const maxContentWidth = width >= 430 ? 430 : 410;
  const isBusy = isProcessing || isRestoring;
  const canPurchase =
    Boolean(plan.rcPackage) && currentPlanKey !== "lifetime" && !isBusy;
  const buttonLabel = currentPlanKey === "lifetime"
    ? "Lifetime already active"
    : isProcessing
      ? "Processing..."
      : "Unlock Lifetime Premium";
  const lifetimeOffering =
    paywallConfig?.offerings.find(offering => offering.key === "lifetime") ??
    DEFAULT_LIFETIME_OFFERING;
  const displayedPrice =
    plan.rcPackage?.product.priceString || "Price unavailable";
  const claimLimit = lifetimeOffering.purchaseLimit ?? null;
  const claimCount = lifetimeOffering.purchasedUsersCount ?? 0;
  const claimProgress =
    claimLimit && claimLimit > 0 ? Math.min(claimCount / claimLimit, 1) : 0;
  const claimText = claimLimit ? `${claimCount}/${claimLimit} claimed` : `${claimCount} claimed`;
  const priceSupportText = [
    paywallConfig?.template?.purchaseChipTitle
      ? `${paywallConfig.template.purchaseChipTitle} purchase`
      : lifetimeOffering.priceSuffix?.trim()
        ? lifetimeOffering.priceSuffix.includes("one-time")
          ? "One-time purchase"
          : lifetimeOffering.priceSuffix.trim()
        : "One-time purchase",
    paywallConfig?.template?.purchaseChipBody || null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  const closeEntrance = useRef(new Animated.Value(0)).current;
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const priceEntrance = useRef(new Animated.Value(0)).current;
  const footerEntrance = useRef(new Animated.Value(0)).current;
  const featureAnims = useRef(FEATURE_ROWS.map(() => new Animated.Value(0))).current;
  const topGlowPulse = useRef(new Animated.Value(0)).current;
  const bottomGlowPulse = useRef(new Animated.Value(0)).current;
  const heroGlowPulse = useRef(new Animated.Value(0)).current;
  const sparklePulse = useRef(new Animated.Value(0)).current;
  const priceSheen = useRef(new Animated.Value(0)).current;
  const ctaSheen = useRef(new Animated.Value(0)).current;
  const claimProgressAnim = useRef(new Animated.Value(0)).current;
  const testimonialTransition = useRef(new Animated.Value(1)).current;

  const currentTestimonial =
    TESTIMONIALS[testimonialIndex % TESTIMONIALS.length] ?? TESTIMONIALS[0];

  const trackLifetimeEvent = useCallback(
    (
      eventType:
        | "paywall_impression"
        | "cta_tap"
        | "purchase_success"
        | "restore_success"
        | "purchase_failure",
      metadata?: Record<string, unknown>
    ) => {
      if (!sessionUserId) {
        return Promise.resolve(null);
      }

      return trackPaywallEvent({
        placementKey: "profile_upgrade_banner",
        screenKey: "profile",
        eventType,
        templateKey: "lifetime-launch",
        offeringKey: "lifetime",
        metadata,
      }).catch(() => null);
    },
    [sessionUserId]
  );

  useEffect(() => {
    let isMounted = true;

    const loadLifetimeOffer = async () => {
      setPlansError(getRevenueCatConfigurationError());
      setIsLoadingPlan(true);

      try {
        const [configResult, offeringsResult] = await Promise.allSettled([
          sessionUserId
            ? getPaywallConfig({
                placementKey: "profile_upgrade_banner",
                screenKey: "profile",
                triggerMode: "contextual",
              })
            : Promise.resolve(null),
          getRevenueCatOfferings(sessionUserId),
        ]);

        if (!isMounted) {
          return;
        }

        const resolvedConfig =
          configResult.status === "fulfilled" ? configResult.value : null;

        if (resolvedConfig?.shouldShow === false) {
          onBack();
          return;
        }

        setPaywallConfig(resolvedConfig);

        const configuredLifetimeOffering =
          resolvedConfig?.offerings.find(offering => offering.key === "lifetime") ??
          DEFAULT_LIFETIME_OFFERING;

        if (offeringsResult.status !== "fulfilled") {
          throw offeringsResult.reason;
        }

        setRevenueCatOfferings(offeringsResult.value);

        const resolvedPlan =
          getRevenueCatPaywallPlans(
            offeringsResult.value,
            [configuredLifetimeOffering],
            { placementKey: "profile_upgrade_banner" }
          ).find(candidate => candidate.planKey === "lifetime") ??
          buildFallbackPlan(configuredLifetimeOffering);

        setPlan(resolvedPlan);
        setPlansError(
          resolvedPlan.rcPackage
            ? null
            : "This lifetime offer is visible, but the live purchase package is not available yet."
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPaywallConfig(null);
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
  }, [onBack, sessionUserId]);

  useEffect(() => {
    if (isLoadingPlan || screenState !== "offer") {
      closeEntrance.setValue(0);
      heroEntrance.setValue(0);
      priceEntrance.setValue(0);
      footerEntrance.setValue(0);
      featureAnims.forEach(animation => animation.setValue(0));
      return;
    }

    closeEntrance.setValue(0);
    heroEntrance.setValue(0);
    priceEntrance.setValue(0);
    footerEntrance.setValue(0);
    featureAnims.forEach(animation => animation.setValue(0));

    Animated.parallel([
      Animated.timing(closeEntrance, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 520,
        delay: 80,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(priceEntrance, {
        toValue: 1,
        duration: 360,
        delay: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        100,
        featureAnims.map(animation =>
          Animated.timing(animation, {
            toValue: 1,
            duration: 260,
            delay: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ),
      Animated.timing(footerEntrance, {
        toValue: 1,
        duration: 360,
        delay: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const topGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(topGlowPulse, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(topGlowPulse, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const bottomGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bottomGlowPulse, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bottomGlowPulse, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const heroGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroGlowPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroGlowPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparklePulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sparklePulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const priceSheenLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(priceSheen, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(priceSheen, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    );

    const ctaSheenLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaSheen, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaSheen, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
      ])
    );

    topGlowLoop.start();
    bottomGlowLoop.start();
    heroGlowLoop.start();
    sparkleLoop.start();
    priceSheenLoop.start();
    ctaSheenLoop.start();

    return () => {
      topGlowLoop.stop();
      bottomGlowLoop.stop();
      heroGlowLoop.stop();
      sparkleLoop.stop();
      priceSheenLoop.stop();
      ctaSheenLoop.stop();
    };
  }, [
    bottomGlowPulse,
    closeEntrance,
    ctaSheen,
    featureAnims,
    footerEntrance,
    heroEntrance,
    heroGlowPulse,
    isLoadingPlan,
    priceEntrance,
    priceSheen,
    screenState,
    sparklePulse,
    topGlowPulse,
  ]);

  useEffect(() => {
    claimProgressAnim.setValue(0);

    Animated.timing(claimProgressAnim, {
      toValue: claimProgress,
      duration: 1200,
      delay: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [claimProgress, claimProgressAnim]);

  useEffect(() => {
    testimonialTransition.stopAnimation();
    testimonialTransition.setValue(0);

    Animated.timing(testimonialTransition, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [testimonialIndex, testimonialTransition]);

  useEffect(() => {
    if (TESTIMONIALS.length < 2) {
      return;
    }

    const intervalId = setInterval(() => {
      setTestimonialIndex(previous => (previous + 1) % TESTIMONIALS.length);
    }, 4000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    trackLifetimeEvent("paywall_impression");
  }, [trackLifetimeEvent]);

  const completePremiumActivation = useCallback(
    async (customerInfo: CustomerInfo, options: { wasRestore?: boolean } = {}) => {
      const premiumAccess = hasPremiumAccess(customerInfo);
      const attribution = getRevenueCatPurchaseAttribution(
        customerInfo,
        revenueCatOfferings
      );

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
      setIsPurchaseAccessUpdating(false);
      setScreenState("success");
      return true;
    },
    [revenueCatOfferings, setSessionUserProfile]
  );

  const finalizePremiumActivation = useCallback(
    async (customerInfo: CustomerInfo, options: { wasRestore?: boolean } = {}) => {
      const activated = await completePremiumActivation(customerInfo, options);

      if (activated !== false || !sessionUserId) {
        return activated;
      }

      const refreshedEntitlementState = await refreshRevenueCatEntitlementState(
        sessionUserId
      );

      if (!refreshedEntitlementState.customerInfo) {
        return false;
      }

      return completePremiumActivation(refreshedEntitlementState.customerInfo, options);
    },
    [completePremiumActivation, sessionUserId]
  );

  const handlePurchase = useCallback(async () => {
    if (currentPlanKey === "lifetime") {
      Alert.alert("Lifetime already active", "This account already has lifetime access.");
      return;
    }

    if (!plan.rcPackage) {
      Alert.alert(
        "Offer unavailable",
        "This lifetime offer is not available right now."
      );
      return;
    }

    setIsProcessing(true);
    await trackLifetimeEvent("cta_tap");

    try {
      const result = await purchaseRevenueCatPackage(plan.rcPackage, sessionUserId);
      const activated = await finalizePremiumActivation(result.customerInfo);

      if (!activated) {
        setIsPurchaseAccessUpdating(true);
        setScreenState("success");
        await trackLifetimeEvent("purchase_success", {
          activationPending: true,
        });
        return;
      }

      await trackLifetimeEvent("purchase_success", {
        store: getRevenueCatActiveEntitlement(result.customerInfo)?.store || "unknown",
      });
    } catch (error) {
      if (
        isPurchasesError(error) &&
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
      ) {
        return;
      }

      if (__DEV__) {
        console.warn("[RevenueCat] Lifetime paywall purchase failed.", error);
      }

      await trackLifetimeEvent("purchase_failure", {
        message: getPurchaseErrorMessage(error),
      });
      Alert.alert("Purchase failed", getPurchaseErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  }, [
    currentPlanKey,
    finalizePremiumActivation,
    plan.rcPackage,
    sessionUserId,
    trackLifetimeEvent,
  ]);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);
      const activated = await finalizePremiumActivation(customerInfo, {
        wasRestore: true,
      });

      if (!activated) {
        Alert.alert(
          NO_RESTORED_PURCHASE_TITLE,
          NO_RESTORED_PURCHASE_MESSAGE
        );
        return;
      }

      await trackLifetimeEvent("restore_success", {
        store: getRevenueCatActiveEntitlement(customerInfo)?.store || "unknown",
      });
    } catch (error) {
      if (__DEV__) {
        console.warn("[RevenueCat] Lifetime paywall restore failed.", error);
      }

      Alert.alert(
        "Restore failed",
        getPurchaseErrorMessage(error)
      );
    } finally {
      setIsRestoring(false);
    }
  }, [finalizePremiumActivation, sessionUserId, trackLifetimeEvent]);

  if (screenState === "success") {
    return (
      <ActionSuccessScreen
        variant="payment"
        title={
          isPurchaseAccessUpdating
            ? PURCHASE_UPDATING_SUCCESS_TITLE
            : "Lifetime access is active."
        }
        subtitle={
          isPurchaseAccessUpdating
            ? PURCHASE_UPDATING_SUCCESS_MESSAGE
            : `Journal.IO now has permanent premium access on this account for ${sessionUserName}.`
        }
        buttonLabel="Return to Subscription"
        onPrimaryAction={onBack}
      />
    );
  }

  if (isLoadingPlan) {
    return (
      <View style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <View style={styles.loaderRoot}>
          <View
            style={[
              styles.loaderCard,
              {
                backgroundColor: hexToRgba(palette.card, 0.88),
                borderColor: hexToRgba(palette.border, 0.7),
              },
            ]}
          >
            <View
              style={[
                styles.loaderIconWrap,
                { backgroundColor: hexToRgba(palette.primary, 0.14) },
              ]}
            >
              <Crown size={20} color={palette.primary} strokeWidth={2.1} />
            </View>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.loaderTitle, { color: palette.foreground }]}>
              {LIFETIME_LOADER_COPY}
            </Text>
            <Text
              style={[styles.loaderSubtitle, { color: palette.mutedForeground }]}
            >
              Fetching current pricing and claim availability.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const topGlowScale = topGlowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });
  const topGlowOpacity = topGlowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.45],
  });
  const bottomGlowScale = bottomGlowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const bottomGlowOpacity = bottomGlowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.35],
  });
  const heroScale = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const heroRotate = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: ["-20deg", "0deg"],
  });
  const heroOpacity = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const heroTextTranslate = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 0],
  });
  const heroGlowScale = heroGlowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const heroGlowOpacity = heroGlowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });
  const sparkleOpacity = sparklePulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });
  const sparkleScale = sparklePulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
  });
  const priceTranslate = priceEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const footerTranslate = footerEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 0],
  });
  const closeOpacity = closeEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const priceSheenTranslate = priceSheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 340],
  });
  const ctaSheenTranslate = ctaSheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 380],
  });
  const claimWidth = claimProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${claimProgress * 100}%`],
  });
  const testimonialOpacity = testimonialTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const testimonialTranslate = testimonialTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <View style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.topGlow,
            {
              backgroundColor: hexToRgba(palette.primary, 0.2),
              opacity: topGlowOpacity,
              transform: [{ scale: topGlowScale }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bottomGlow,
            {
              backgroundColor: hexToRgba(palette.warning, 0.15),
              opacity: bottomGlowOpacity,
              transform: [{ scale: bottomGlowScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.closeWrap,
            {
              top: insets.top + 12,
              right: horizontalPadding,
              opacity: closeOpacity,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close lifetime offer"
            onPress={onBack}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: hexToRgba(palette.card, 0.5),
                borderColor: hexToRgba(palette.border, 0.5),
              },
              pressed && styles.pressed,
            ]}
          >
            <X size={16} color={palette.mutedForeground} />
          </Pressable>
        </Animated.View>

        <View style={styles.contentWrap}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + 66,
                paddingHorizontal: horizontalPadding,
              },
            ]}
          >
            <View style={[styles.contentShell, { maxWidth: maxContentWidth }]}>
              <View style={styles.heroSection}>
                <Animated.View
                  style={[
                    styles.heroIconWrap,
                    isCompact && styles.heroIconWrapCompact,
                    {
                      opacity: heroOpacity,
                      transform: [{ scale: heroScale }, { rotate: heroRotate }],
                    },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.heroGlow,
                      {
                        backgroundColor: hexToRgba(palette.primary, 0.3),
                        opacity: heroGlowOpacity,
                        transform: [{ scale: heroGlowScale }],
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.heroCore,
                      {
                        backgroundColor: palette.primary,
                        shadowColor: palette.primary,
                      },
                    ]}
                  >
                    <Crown size={28} color={palette.primaryForeground} strokeWidth={2} />
                  </View>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.heroSparkleWrap,
                      {
                        opacity: sparkleOpacity,
                        transform: [{ scale: sparkleScale }],
                      },
                    ]}
                  >
                    <Sparkles size={14} color={palette.warning} />
                  </Animated.View>
                </Animated.View>

                <Animated.Text
                  style={[
                    styles.heroTitle,
                    isCompact ? styles.heroTitleCompact : styles.heroTitleRegular,
                    {
                      color: palette.foreground,
                      opacity: heroOpacity,
                      transform: [{ translateY: heroTextTranslate }],
                    },
                  ]}
                >
                  Go Premium. <Text style={{ color: palette.primary }}>Forever.</Text>
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.heroSubtitle,
                    {
                      color: palette.mutedForeground,
                      opacity: heroOpacity,
                      transform: [
                        {
                          translateY: heroEntrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [10, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  One payment. No subscriptions. No renewals. Yours for life.
                </Animated.Text>
              </View>

              <Animated.View
                style={[
                  styles.priceCard,
                  {
                    backgroundColor: hexToRgba(palette.primary, 0.08),
                    borderColor: hexToRgba(palette.primary, 0.15),
                    opacity: priceEntrance,
                    transform: [{ translateY: priceTranslate }],
                  },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.priceSheen,
                    {
                      backgroundColor: hexToRgba(palette.primary, 0.05),
                      transform: [{ translateX: priceSheenTranslate }],
                    },
                  ]}
                />
                <View style={styles.priceTopRow}>
                  <View style={styles.priceTextGroup}>
                    <View style={styles.priceHeadlineRow}>
                      <Text style={[styles.priceValue, { color: palette.foreground }]}>
                        {displayedPrice}
                      </Text>
                    </View>
                    <Text style={[styles.priceSubText, { color: palette.mutedForeground }]}>
                      {priceSupportText}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.limitedBadge,
                      {
                        backgroundColor: hexToRgba(palette.success, 0.1),
                        borderColor: hexToRgba(palette.success, 0.2),
                      },
                    ]}
                  >
                    <Star size={10} color={palette.success} fill={palette.success} />
                    <Text style={[styles.limitedBadgeText, { color: palette.success }]}>
                      {LIFETIME_BADGE}
                    </Text>
                  </View>
                </View>

                <View style={styles.claimRow}>
                  <View
                    style={[
                      styles.claimTrack,
                      { backgroundColor: hexToRgba(palette.border, 0.5) },
                    ]}
                  >
                    <Animated.View style={[styles.claimFill, { width: claimWidth }]}>
                      <View
                        style={[
                          styles.claimFillMain,
                          { backgroundColor: palette.primary },
                        ]}
                      />
                      <View
                        style={[
                          styles.claimFillTail,
                          { backgroundColor: palette.warning },
                        ]}
                      />
                    </Animated.View>
                  </View>
                  <Text style={[styles.claimText, { color: palette.warning }]}>
                    {claimText}
                  </Text>
                </View>
              </Animated.View>

              <View style={styles.featureStack}>
                {FEATURE_ROWS.map((feature, index) => {
                  const featureTranslate = featureAnims[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [-15, 0],
                  });

                  return (
                    <Animated.View
                      key={feature.title}
                      style={[
                        styles.featureCard,
                        {
                          backgroundColor: hexToRgba(palette.card, 0.6),
                          borderColor: hexToRgba(palette.border, 0.5),
                          opacity: featureAnims[index],
                          transform: [{ translateX: featureTranslate }],
                        },
                      ]}
                    >
                      <FeatureItem
                        icon={feature.icon}
                        title={feature.title}
                        accentColor={hexToRgba(palette.primary, 0.1)}
                        iconColor={palette.primary}
                        textColor={hexToRgba(palette.foreground, 0.9)}
                      />
                    </Animated.View>
                  );
                })}
              </View>

              <View style={styles.testimonialSection}>
                <View style={styles.testimonialInner}>
                  <Animated.View
                    key={testimonialIndex}
                    style={[
                      styles.testimonialCard,
                      {
                        opacity: testimonialOpacity,
                        transform: [{ translateY: testimonialTranslate }],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.testimonialQuote,
                        { color: palette.mutedForeground },
                      ]}
                    >
                      {currentTestimonial.quote}
                    </Text>
                    <Text
                      style={[
                        styles.testimonialName,
                        { color: hexToRgba(palette.primary, 0.7) },
                      ]}
                    >
                      — {currentTestimonial.name}
                    </Text>
                  </Animated.View>
                </View>
              </View>
            </View>
          </ScrollView>

          <Animated.View
            style={[
              styles.footerSection,
              {
                paddingHorizontal: horizontalPadding,
                paddingBottom: Math.max(insets.bottom, 24),
                opacity: footerEntrance,
                transform: [{ translateY: footerTranslate }],
              },
            ]}
          >
            <View style={[styles.footerShell, { maxWidth: maxContentWidth }]}>
              {plansError ? (
                <Text style={[styles.footerNote, { color: palette.mutedForeground }]}>
                  {plansError}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Unlock Lifetime Premium"
                onPress={handlePurchase}
                disabled={!canPurchase || isLoadingPlan}
                style={({ pressed }) => [
                  styles.ctaButton,
                  {
                    backgroundColor: palette.primary,
                    shadowColor: palette.primary,
                  },
                  (!canPurchase || isLoadingPlan) && styles.ctaDisabled,
                  pressed && canPurchase && !isLoadingPlan && styles.ctaPressed,
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.ctaSheen,
                    {
                      transform: [{ translateX: ctaSheenTranslate }],
                    },
                  ]}
                />
                {isProcessing ? (
                  <View style={styles.processingContent}>
                    <Animated.View
                      style={{
                        transform: [
                          {
                            rotate: sparklePulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0deg", "360deg"],
                            }),
                          },
                        ],
                      }}
                    >
                      <Sparkles
                        size={16}
                        color={palette.primaryForeground}
                        strokeWidth={2}
                      />
                    </Animated.View>
                    <Text style={[styles.ctaText, { color: palette.primaryForeground }]}>
                      {buttonLabel}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.ctaContent}>
                    <Crown size={18} color={palette.primaryForeground} strokeWidth={2.2} />
                    <Text style={[styles.ctaText, { color: palette.primaryForeground }]}>
                      {buttonLabel}
                    </Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.guaranteeRow}>
                <Check size={10} color={palette.success} />
                <Text style={[styles.guaranteeText, { color: palette.mutedForeground }]}>
                  One-time App Store purchase
                </Text>
                <Text style={[styles.guaranteeDot, { color: palette.border }]}>·</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Restore"
                  onPress={handleRestore}
                  disabled={isBusy || isLoadingPlan}
                  style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
                >
                  {isRestoring ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Text style={[styles.restoreText, { color: hexToRgba(palette.primary, 0.6) }]}>
                      Restore
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loaderRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loaderCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 12,
  },
  loaderIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  loaderSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  root: {
    flex: 1,
    overflow: "hidden",
  },
  contentWrap: {
    flex: 1,
  },
  topGlow: {
    position: "absolute",
    top: "-20%",
    right: "-15%",
    width: "70%",
    height: "50%",
    borderRadius: 999,
  },
  bottomGlow: {
    position: "absolute",
    bottom: "-15%",
    left: "-20%",
    width: "60%",
    height: "45%",
    borderRadius: 999,
  },
  closeWrap: {
    position: "absolute",
    zIndex: 20,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },
  contentShell: {
    width: "100%",
    flexGrow: 1,
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  heroIconWrap: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 16,
  },
  heroIconWrapCompact: {
    marginBottom: 14,
  },
  heroGlow: {
    position: "absolute",
    top: -12,
    right: -12,
    bottom: -12,
    left: -12,
    borderRadius: 999,
    shadowRadius: 12,
    shadowOpacity: 0.1,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },
  heroCore: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 3,
  },
  heroSparkleWrap: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  heroTitle: {
    textAlign: "center",
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  heroTitleRegular: {
    fontSize: 39,
    lineHeight: 46,
  },
  heroTitleCompact: {
    fontSize: 36,
    lineHeight: 42,
  },
  heroSubtitle: {
    textAlign: "center",
    maxWidth: 260,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    marginTop: 6,
  },
  priceCard: {
    marginHorizontal: 0,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  priceSheen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
  },
  priceTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  priceTextGroup: {
    flex: 1,
    gap: 2,
  },
  priceHeadlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  priceValue: {
    fontSize: 46,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  priceSubText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  limitedBadge: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  limitedBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  claimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  claimTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  claimFill: {
    height: "100%",
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 999,
  },
  claimFillMain: {
    flex: 7,
  },
  claimFillTail: {
    flex: 3,
  },
  claimText: {
    minWidth: 82,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  featureStack: {
    gap: 10,
    marginTop: 20,
  },
  featureCard: {
    borderRadius: 20,
    borderWidth: 1,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  testimonialSection: {
    flex: 1,
    minHeight: 72,
    justifyContent: "center",
    marginTop: 16,
    paddingBottom: 6,
  },
  testimonialInner: {
    width: "100%",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  testimonialCard: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 20,
  },
  testimonialQuote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    fontStyle: "italic",
    textAlign: "center",
  },
  testimonialName: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
  },
  footerSection: {
    paddingTop: 8,
  },
  footerShell: {
    width: "100%",
    alignSelf: "center",
    gap: 12,
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  ctaButton: {
    minHeight: 56,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 3,
  },
  ctaSheen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "40%",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  processingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.97 }],
  },
  guaranteeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  guaranteeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "400",
  },
  guaranteeDot: {
    fontSize: 10,
    lineHeight: 10,
    marginHorizontal: 4,
  },
  restoreButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
