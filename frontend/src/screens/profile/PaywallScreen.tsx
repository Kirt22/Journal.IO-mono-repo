import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Lock,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import mascotImage from "../../assets/png/Masscott.png";

type PaywallScreenProps = {
  onBack: (reason?: "dismiss" | "continue") => void;
};

type Plan = {
  id: string;
  durationLabel: string;
  title: string;
  price: string;
  subtitle: string;
  highlight?: string;
  badge?: string;
  offeringKey?: PaywallOffering["key"];
  revenueCatOfferingId?: string | null;
  revenueCatPackageId?: string | null;
  rcPackage?: RevenueCatPaywallPlan["rcPackage"];
};

type ScreenState = "paywall" | "success";
type ShowcaseCard = {
  id: string;
  title: string;
  body: string;
  footer: string;
  icon: typeof Sparkles;
};

const placeholderPlans: Plan[] = [
  {
    id: "weekly",
    durationLabel: "$7.99",
    title: "WEEKLY",
    price: "$7.99/week",
    subtitle: "Flexible access",
  },
  {
    id: "yearly",
    durationLabel: "$299.99",
    title: "YEARLY",
    price: "$299.99/year",
    subtitle: "Most value",
    highlight: "Save 22%",
    badge: "Most Value",
  },
];

const successTags = ["AI insights", "Weekly clarity"];

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
    return "RevenueCat is configured, but the selected product or offering is not ready yet.";
  }

  if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return "This payment is pending. RevenueCat will update the entitlement as soon as the store confirms it.";
  }

  return error.message;
};

const showcaseIcons = [Sparkles, TrendingUp, Crown, Lock] as const;

const buildShowcaseCards = (
  paywallConfig: ResolvedPaywallConfig | null
): ShowcaseCard[] => {
  const fallbackFeatures: PaywallFeatureCard[] = [
    {
      title: "AI insights in your pocket",
      body: "Journal.IO highlights recurring emotions, themes, and habits so your writing becomes easier to understand over time.",
      footer: "Premium tools that stay close to your journaling rhythm.",
    },
    {
      title: "Weekly analysis with concise pattern reads",
      body: "See a calmer summary of what your recent entries may be pointing toward each week.",
      footer: "Short reads on Home, deeper context in Insights.",
    },
    {
      title: "Prompt support that keeps writing moving",
      body: "Use premium prompts and entry-level analysis when you want more structure without more effort.",
      footer: "Designed to help, not interrupt.",
    },
  ];
  const features = paywallConfig?.template?.featureList?.length
    ? paywallConfig.template.featureList
    : fallbackFeatures;

  return features.slice(0, 4).map((feature, index) => ({
    id: `${paywallConfig?.template?.key || "default"}-${index}`,
    title: feature.title,
    body: feature.body,
    footer: feature.footer || "Premium tools that stay close to your journaling rhythm.",
    icon: showcaseIcons[index] || Sparkles,
  }));
};

function PlanCard({
  plan,
  selected,
  onPress,
  delay,
}: {
  plan: Plan;
  selected: boolean;
  onPress: () => void;
  delay: number;
}) {
  const theme = useTheme();
  const entryAnim = useRef(new Animated.Value(0)).current;
  const selectedAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, entryAnim]);

  useEffect(() => {
    Animated.spring(selectedAnim, {
      toValue: selected ? 1 : 0,
      friction: 8,
      tension: 86,
      useNativeDriver: true,
    }).start();
  }, [selected, selectedAnim]);

  const scale = selectedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });
  const checkScale = selectedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });
  const containerStyle = {
    backgroundColor: selected ? theme.colors.primary : theme.colors.card,
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    shadowColor: theme.colors.primary,
  };
  const durationStyle = {
    color: selected ? theme.colors.primaryForeground : theme.colors.foreground,
  };
  const titleStyle = {
    color: selected ? theme.colors.primaryForeground : theme.colors.foreground,
  };
  const subtitleStyle = {
    color: selected ? `${theme.colors.primaryForeground}CC` : theme.colors.mutedForeground,
  };
  const priceStyle = {
    color: selected ? theme.colors.primaryForeground : theme.colors.foreground,
  };

  return (
    <Animated.View
      style={[
        styles.planCardWrap,
        {
          opacity: entryAnim,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.planCard, containerStyle, pressed && styles.pressed]}
      >
        {plan.badge ? (
          <View
            style={[
              styles.planBadge,
              {
                backgroundColor: selected
                  ? `${theme.colors.primaryForeground}24`
                  : `${theme.colors.foreground}10`,
              },
            ]}
          >
            <Text style={[styles.planBadgeText, durationStyle]}>{plan.badge}</Text>
          </View>
        ) : (
          <View style={styles.planBadgeSpacer} />
        )}

        {selected ? (
          <Animated.View
            style={[
              styles.planCheck,
              {
                backgroundColor: theme.colors.primaryForeground,
                transform: [{ scale: checkScale }],
              },
            ]}
          >
            <CheckCircle2 size={14} color={theme.colors.primary} />
          </Animated.View>
        ) : null}

        <Text style={[styles.planDuration, durationStyle]}>{plan.durationLabel}</Text>
        <Text style={[styles.planTitle, titleStyle]}>{plan.title}</Text>
        <Text style={[styles.planPrice, priceStyle]}>{plan.price}</Text>
        <Text style={[styles.planSubtitle, subtitleStyle]}>
          {plan.highlight ?? plan.subtitle}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function PaywallScreen({ onBack }: PaywallScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
  const isCompact = width < 360;
  const horizontalPadding = isCompact ? 16 : width > 430 ? 28 : 22;
  const [plans, setPlans] = useState<Plan[]>(placeholderPlans);
  const [selectedPlan, setSelectedPlan] = useState<Plan["id"]>("weekly");
  const [paywallConfig, setPaywallConfig] = useState<ResolvedPaywallConfig | null>(
    null
  );
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(
    getRevenueCatConfigurationError()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>("paywall");
  const [lastPurchaseStore, setLastPurchaseStore] = useState<string | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const plansAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const successPulse = useRef(new Animated.Value(0)).current;
  const successHeroFloat = useRef(new Animated.Value(0)).current;
  const successSceneDrift = useRef(new Animated.Value(0)).current;
  const mascotFloat = useRef(new Animated.Value(0)).current;
  const haloPulse = useRef(new Animated.Value(0)).current;
  const backgroundBubbleDrift = useRef(new Animated.Value(0)).current;
  const showcaseTransitionProgress = useRef(new Animated.Value(1)).current;
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const paywallPlacementKey = activePaywallPlacementKey || "post_auth";
  const showcaseCards = useMemo(
    () => buildShowcaseCards(paywallConfig),
    [paywallConfig]
  );

  const selectedPlanDetails =
    plans.find(plan => plan.id === selectedPlan) ?? plans[plans.length - 1];
  const activeShowcaseCard = showcaseCards[showcaseIndex] ?? showcaseCards[0];
  const ActiveShowcaseIcon = activeShowcaseCard.icon;
  const isBusy = isProcessing || isRestoring;
  const canPurchaseSelectedPlan = Boolean(selectedPlanDetails?.rcPackage);
  const successDisplayTags =
    lastPurchaseStore === "TEST_STORE"
      ? ["RevenueCat test", "AI insights"]
      : successTags;

  useEffect(() => {
    let isMounted = true;

    const loadPaywall = async () => {
      setPlansError(getRevenueCatConfigurationError());
      setIsLoadingPlans(true);

      try {
        const resolvedConfig = sessionUserId
          ? await getPaywallConfig({
              placementKey: paywallPlacementKey,
              screenKey: activePaywallScreenKey || undefined,
              triggerMode: activePaywallTriggerMode,
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

        if (!isMounted) {
          return;
        }

        if (!livePlans.length) {
          setPlansError(
            "RevenueCat is connected, but the selected paywall template does not have a matching live package yet."
          );
          return;
        }

        const nextPlans: Plan[] = livePlans.map(plan => ({
          id: plan.id,
          durationLabel: plan.durationLabel,
          title: plan.title,
          price: plan.price,
          subtitle: plan.subtitle,
          highlight: plan.highlight,
          badge: plan.badge,
          offeringKey: resolvedConfig?.offerings.find(
            configuredOffering => configuredOffering.key === plan.id
          )?.key,
          revenueCatOfferingId:
            resolvedConfig?.offerings.find(
              configuredOffering => configuredOffering.key === plan.id
            )?.revenueCatOfferingId || null,
          revenueCatPackageId:
            resolvedConfig?.offerings.find(
              configuredOffering => configuredOffering.key === plan.id
            )?.revenueCatPackageId || null,
          rcPackage: plan.rcPackage,
        }));

        setPlans(nextPlans);
        setSelectedPlan(previous =>
          nextPlans.some(plan => plan.id === previous)
            ? previous
            : nextPlans[0]?.id ?? previous
        );
        setPlansError(
          nextPlans.some(plan => plan.rcPackage)
            ? null
            : "The selected paywall is visible, but its live RevenueCat package is not available yet."
        );

        if (resolvedConfig?.template) {
          trackPaywallEvent({
            placementKey: resolvedConfig.placementKey,
            screenKey: resolvedConfig.screenKey || undefined,
            eventType: "paywall_impression",
            templateKey: resolvedConfig.template.key,
            offeringKey: resolvedConfig.template.primaryOfferingKey,
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
            : "We could not load live billing plans from RevenueCat."
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
    activePaywallScreenKey,
    activePaywallTriggerMode,
    onBack,
    paywallPlacementKey,
    sessionUserId,
  ]);

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
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(plansAnim, {
        toValue: 1,
        duration: 340,
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

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(mascotFloat, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(haloPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const backgroundBubbleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundBubbleDrift, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backgroundBubbleDrift, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    haloLoop.start();
    backgroundBubbleLoop.start();

    return () => {
      floatLoop.stop();
      haloLoop.stop();
      backgroundBubbleLoop.stop();
    };
  }, [
    backgroundBubbleDrift,
    cardAnim,
    footerAnim,
    haloPulse,
    headerAnim,
    heroAnim,
    mascotFloat,
    plansAnim,
  ]);

  useEffect(() => {
    if (screenState !== "success") {
      return;
    }

    successAnim.setValue(0);
    Animated.timing(successAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const successLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(successPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(successPulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const successFloatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(successHeroFloat, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(successHeroFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const successSceneLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(successSceneDrift, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(successSceneDrift, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    successLoop.start();
    successFloatLoop.start();
    successSceneLoop.start();

    return () => {
      successLoop.stop();
      successFloatLoop.stop();
      successSceneLoop.stop();
    };
  }, [screenState, successAnim, successHeroFloat, successPulse, successSceneDrift]);

  useEffect(() => {
    if (screenState !== "success") {
      return;
    }

    const timeoutId = setTimeout(() => {
      onBack("continue");
    }, 900);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [onBack, screenState]);

  useEffect(() => {
    if (showcaseCards.length < 2) {
      return;
    }

    const intervalId = setInterval(() => {
      setShowcaseIndex(previous => (previous + 1) % showcaseCards.length);
    }, 2800);

    return () => {
      clearInterval(intervalId);
    };
  }, [showcaseCards.length]);

  useEffect(() => {
    showcaseTransitionProgress.stopAnimation();
    showcaseTransitionProgress.setValue(0);
    Animated.timing(showcaseTransitionProgress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeShowcaseCard, showcaseTransitionProgress]);

  useEffect(() => {
    if (isPremiumUser) {
      setScreenState("success");
    }
  }, [isPremiumUser]);

  const handleClose = () => {
    if (paywallConfig?.template) {
      trackPaywallEvent({
        placementKey: paywallConfig.placementKey,
        screenKey: paywallConfig.screenKey || undefined,
        eventType: "paywall_dismiss",
        templateKey: paywallConfig.template.key,
        offeringKey: selectedPlanDetails?.offeringKey,
        wasInterruptive: paywallConfig.wasInterruptive,
      }).catch(() => undefined);
    }

    onBack("dismiss");
  };

  const handleContinueFromSuccess = () => {
    onBack("continue");
  };

  const completePremiumActivation = async (
    customerInfo: Awaited<ReturnType<typeof restoreRevenueCatPurchases>>,
    options: { wasRestore?: boolean } = {}
  ) => {
    const activeEntitlement = getRevenueCatActiveEntitlement(customerInfo);
    const hasPremiumAccess = hasRevenueCatPremiumAccess(customerInfo);

    setLastPurchaseStore(activeEntitlement?.store ?? null);

    if (!hasPremiumAccess) {
      return false;
    }

    if (!selectedPlanDetails?.offeringKey) {
      await setSessionPremiumStatus(true);
      setScreenState("success");
      return true;
    }

    const updatedProfile = await syncPaywallPurchase({
      offeringKey: selectedPlanDetails.offeringKey,
      revenueCatOfferingId:
        selectedPlanDetails.revenueCatOfferingId || paywallConfig?.placementKey || "unknown",
      revenueCatPackageId:
        selectedPlanDetails.revenueCatPackageId ||
        selectedPlanDetails.rcPackage?.identifier ||
        "unknown",
      store: activeEntitlement?.store || "unknown",
      entitlementId: activeEntitlement?.identifier || "unknown",
      wasRestore: Boolean(options.wasRestore),
    });

    setSessionUserProfile(updatedProfile);
    setScreenState("success");
    return true;
  };

  const finalizePremiumActivation = async (
    customerInfo: CustomerInfo,
    options: { wasRestore?: boolean } = {}
  ) => {
    const activated = await completePremiumActivation(customerInfo, options);

    if (activated || !sessionUserId) {
      return activated;
    }

    const refreshedCustomerInfo = await getRevenueCatCustomerInfo(sessionUserId);

    if (!refreshedCustomerInfo) {
      return false;
    }

    return completePremiumActivation(refreshedCustomerInfo, options);
  };

  const handleUpgrade = async () => {
    if (!selectedPlanDetails?.rcPackage) {
      Alert.alert(
        "Billing unavailable",
        plansError ||
          "A live RevenueCat package is not available for the selected plan yet."
      );
      return;
    }

    setIsProcessing(true);

    try {
      if (paywallConfig?.template) {
        trackPaywallEvent({
          placementKey: paywallConfig.placementKey,
          screenKey: paywallConfig.screenKey || undefined,
          eventType: "cta_tap",
          templateKey: paywallConfig.template.key,
          offeringKey: selectedPlanDetails.offeringKey,
          wasInterruptive: paywallConfig.wasInterruptive,
        }).catch(() => undefined);
      }

      const purchaseResult = await purchaseRevenueCatPackage(
        selectedPlanDetails.rcPackage,
        sessionUserId
      );
      const activated = await finalizePremiumActivation(purchaseResult.customerInfo);

      if (!activated) {
        Alert.alert(
          "Purchase completed",
          "RevenueCat completed the purchase, but no active premium entitlement was returned yet."
        );
      } else if (paywallConfig?.template) {
        trackPaywallEvent({
          placementKey: paywallConfig.placementKey,
          screenKey: paywallConfig.screenKey || undefined,
          eventType: "purchase_success",
          templateKey: paywallConfig.template.key,
          offeringKey: selectedPlanDetails.offeringKey,
          wasInterruptive: paywallConfig.wasInterruptive,
        }).catch(() => undefined);
      }
    } catch (error) {
      if (
        isPurchasesError(error) &&
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
      ) {
        return;
      }

      Alert.alert(
        "Premium activation unavailable",
        getPurchaseErrorMessage(error)
      );

      if (paywallConfig?.template) {
        trackPaywallEvent({
          placementKey: paywallConfig.placementKey,
          screenKey: paywallConfig.screenKey || undefined,
          eventType: "purchase_failure",
          templateKey: paywallConfig.template.key,
          offeringKey: selectedPlanDetails.offeringKey,
          wasInterruptive: paywallConfig.wasInterruptive,
          metadata: {
            message: getPurchaseErrorMessage(error),
          },
        }).catch(() => undefined);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);
      const hasPremiumAccess = hasRevenueCatPremiumAccess(customerInfo);

      if (!hasPremiumAccess) {
        if (isPremiumUser) {
          await setSessionPremiumStatus(false);
        }

        Alert.alert(
          "No purchases found",
          "RevenueCat did not return an active premium entitlement for this account."
        );
        return;
      }

      await finalizePremiumActivation(customerInfo, { wasRestore: true });

      if (paywallConfig?.template) {
        trackPaywallEvent({
          placementKey: paywallConfig.placementKey,
          screenKey: paywallConfig.screenKey || undefined,
          eventType: "restore_success",
          templateKey: paywallConfig.template.key,
          offeringKey: selectedPlanDetails.offeringKey,
          wasInterruptive: paywallConfig.wasInterruptive,
        }).catch(() => undefined);
      }
    } catch (error) {
      Alert.alert("Restore purchases", getPurchaseErrorMessage(error));
    } finally {
      setIsRestoring(false);
    }
  };

  const headerTranslate = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });
  const heroTranslate = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const cardTranslate = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const plansTranslate = plansAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });
  const footerTranslate = footerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const mascotTranslate = mascotFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });
  const haloScale = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const haloOpacity = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.58],
  });
  const backgroundBubbleOneShift = backgroundBubbleDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 12],
  });
  const backgroundBubbleTwoShift = backgroundBubbleDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -14],
  });
  const backgroundBubbleThreeShift = backgroundBubbleDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 16],
  });
  const successTranslate = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const successGlowScale = successPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });
  const successGlowOpacity = successPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0.48],
  });
  const successHeroFloatTranslate = successHeroFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const successHeroTranslate = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const successBubbleOneShift = successSceneDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 12],
  });
  const successBubbleOneLift = successSceneDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });
  const successBubbleTwoShift = successSceneDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -14],
  });
  const successBubbleTwoLift = successSceneDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });
  const showcaseTranslate = showcaseTransitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const contentStyle = {
    paddingHorizontal: horizontalPadding,
    paddingBottom: 8,
  };
  const footerStyle = {
    backgroundColor: theme.colors.background,
    borderTopColor: theme.colors.border,
    paddingHorizontal: horizontalPadding,
    paddingBottom: 4,
    opacity: footerAnim,
    transform: [{ translateY: footerTranslate }],
  };

  if (screenState === "success") {
    return (
      <SafeAreaView
        edges={["top", "right", "bottom", "left"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.successContainer}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.successBackgroundBubbleTop,
              {
                backgroundColor: `${theme.colors.primary}12`,
                transform: [
                  { translateX: successBubbleOneShift },
                  { translateY: successBubbleOneLift },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.successBackgroundBubbleMiddle,
              {
                backgroundColor: `${theme.colors.primary}08`,
                transform: [
                  { translateX: successBubbleTwoShift },
                  { translateY: successBubbleTwoLift },
                ],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.successContent,
              {
                paddingHorizontal: horizontalPadding,
                opacity: successAnim,
                transform: [{ translateY: successTranslate }],
              },
            ]}
          >
            <View />
            <Animated.View
              style={[
                styles.successHero,
                {
                  transform: [{ translateY: successHeroTranslate }],
                },
              ]}
            >
              <View
                style={[
                  styles.successPill,
                  {
                    backgroundColor: `${theme.colors.primary}12`,
                    borderColor: `${theme.colors.primary}16`,
                  },
                ]}
              >
                <Sparkles size={14} color={theme.colors.primary} />
                <Text style={[styles.successPillText, { color: theme.colors.primary }]}>
                  Premium unlocked
                </Text>
              </View>

              <Animated.View
                style={[
                  styles.successMascotWrap,
                  {
                    transform: [{ translateY: successHeroFloatTranslate }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.successMascotOrbit,
                    { borderColor: `${theme.colors.primary}18` },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.successGlow,
                    {
                      backgroundColor: `${theme.colors.primary}20`,
                      opacity: successGlowOpacity,
                      transform: [{ scale: successGlowScale }],
                    },
                  ]}
                />
                <Animated.Image
                  source={mascotImage}
                  resizeMode="contain"
                  style={styles.successMascot}
                />
                <View
                  style={[
                    styles.successCheck,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <CheckCircle2 size={16} color={theme.colors.primaryForeground} />
                </View>
              </Animated.View>

              <Text style={[styles.successEyebrow, { color: theme.colors.primary }]}>
                Membership active
              </Text>
              <Text style={[styles.successTitle, { color: theme.colors.foreground }]}>
                You&apos;re now a member of Journal.IO.
              </Text>
              <Text style={[styles.successText, { color: theme.colors.mutedForeground }]}>
                Your {selectedPlanDetails.title.toLowerCase()} plan is live, and premium
                insights are now part of your journaling flow.
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.successMetaBlock,
                {
                  opacity: successAnim,
                },
              ]}
            >
              <View style={styles.successMetaRow}>
                <View
                  style={[
                    styles.successMetaPill,
                    {
                      backgroundColor: `${theme.colors.primary}12`,
                    },
                  ]}
                >
                  <Crown size={14} color={theme.colors.primary} />
                  <Text
                    style={[
                      styles.successMetaPillText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {selectedPlanDetails.title}
                  </Text>
                </View>
                <Text style={[styles.successMetaPrice, { color: theme.colors.foreground }]}>
                  {selectedPlanDetails.price}
                </Text>
              </View>

              <View style={styles.successTagRow}>
                {successDisplayTags.map(tag => (
                  <View
                    key={tag}
                    style={[
                      styles.successTag,
                      { backgroundColor: `${theme.colors.primary}10` },
                    ]}
                  >
                    <Sparkles size={12} color={theme.colors.primary} />
                    <Text
                      style={[
                        styles.successTagText,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.successMicroNoteRow}>
                <View
                  style={[
                    styles.successMicroNote,
                    { backgroundColor: `${theme.colors.primary}0D` },
                  ]}
                >
                  <CheckCircle2 size={12} color={theme.colors.primary} />
                  <Text
                    style={[
                      styles.successMicroNoteText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {lastPurchaseStore === "TEST_STORE"
                      ? "RevenueCat Test Store purchase tracked"
                      : "Premium is now active"}
                  </Text>
                </View>
              </View>
            </Animated.View>

            <View />
          </Animated.View>

          <View
            style={[
              styles.successFooter,
              {
                paddingHorizontal: horizontalPadding,
                paddingBottom: insets.bottom + 14,
              },
            ]}
          >
            <PrimaryButton
              label="Continue to Journal.IO"
              onPress={handleContinueFromSuccess}
              tone="accent"
              icon={<ArrowRight size={16} color={theme.colors.primaryForeground} />}
            />
          </View>
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
            styles.backgroundBubbleTopRight,
            {
              backgroundColor: `${theme.colors.primary}12`,
              transform: [{ translateX: backgroundBubbleOneShift }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backgroundBubbleMidLeft,
            {
              backgroundColor: `${theme.colors.primary}0D`,
              transform: [{ translateX: backgroundBubbleTwoShift }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backgroundBubbleBottomRight,
            {
              backgroundColor: `${theme.colors.primary}10`,
              transform: [{ translateX: backgroundBubbleThreeShift }],
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
          <View />
          <Pressable
            accessibilityRole="button"
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: `${theme.colors.foreground}10`,
                borderColor: `${theme.colors.foreground}12`,
              },
              pressed && styles.pressed,
            ]}
          >
            <X size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        </Animated.View>

        <View
          style={[
            styles.content,
            contentStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: heroAnim,
                transform: [{ translateY: heroTranslate }],
              },
            ]}
          >
            <View style={styles.mascotWrap}>
              <Animated.View
                style={[
                  styles.mascotHalo,
                  {
                    backgroundColor: `${theme.colors.primary}18`,
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
            </View>

            <Text style={[styles.appName, { color: theme.colors.foreground }]}>
              {paywallConfig?.template?.title || "Get Journal.IO Premium"}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
              {paywallConfig?.template?.headline ||
                "Get personalized insights to understand your journaling patterns better."}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: cardAnim,
                transform: [{ translateY: cardTranslate }],
              },
            ]}
          >
            <Animated.View
              style={{
                opacity: showcaseTransitionProgress,
                transform: [{ translateX: showcaseTranslate }],
              }}
            >
              <View style={styles.previewFeatureHeader}>
                <View
                  style={[
                    styles.previewFeatureIconWrap,
                    { backgroundColor: `${theme.colors.primary}14` },
                  ]}
                >
                  <ActiveShowcaseIcon size={16} color={theme.colors.primary} />
                </View>
                <Text style={[styles.previewFeatureTitle, { color: theme.colors.foreground }]}>
                  {activeShowcaseCard.title}
                </Text>
              </View>

              <Text style={[styles.previewBody, { color: theme.colors.foreground }]}>
                {activeShowcaseCard.body}
              </Text>

              <View style={styles.previewFooter}>
                <TrendingUp size={14} color={theme.colors.mutedForeground} />
                <Text style={[styles.previewFooterText, { color: theme.colors.mutedForeground }]}>
                  {activeShowcaseCard.footer}
                </Text>
              </View>
            </Animated.View>
          </Animated.View>

          {showcaseCards.length > 1 ? (
            <Animated.View
              style={[
                styles.dotsRow,
                {
                  opacity: cardAnim,
                },
              ]}
            >
              {showcaseCards.map((_, index) => (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${index + 1}`}
                  onPress={() => setShowcaseIndex(index)}
                  style={[
                    styles.dot,
                    index === showcaseIndex
                      ? [styles.dotActive, { backgroundColor: theme.colors.foreground }]
                      : { backgroundColor: `${theme.colors.foreground}2B` },
                  ]}
                />
              ))}
            </Animated.View>
          ) : null}

        </View>

          <Animated.View
            style={[
              styles.footer,
              footerStyle,
            ]}
          >
            <Animated.View
              style={{
                opacity: plansAnim,
              transform: [{ translateY: plansTranslate }],
            }}
          >
            <View style={styles.planRow}>
              {plans.map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan === plan.id}
                  onPress={() => {
                    setSelectedPlan(plan.id);

                    if (paywallConfig?.template) {
                      trackPaywallEvent({
                        placementKey: paywallConfig.placementKey,
                        screenKey: paywallConfig.screenKey || undefined,
                        eventType: "plan_select",
                        templateKey: paywallConfig.template.key,
                        offeringKey: plan.offeringKey,
                        wasInterruptive: paywallConfig.wasInterruptive,
                      }).catch(() => undefined);
                    }
                  }}
                  delay={120 + index * 90}
                />
              ))}
            </View>
          </Animated.View>

          <PrimaryButton
            label={
              isProcessing
                ? "Processing..."
                : isLoadingPlans
                  ? "Loading plans..."
                  : "Start Journal.IO Premium"
            }
            onPress={handleUpgrade}
            loading={isProcessing}
            tone="accent"
            disabled={!canPurchaseSelectedPlan || isLoadingPlans || isRestoring}
          />

          <View style={styles.footerLinks}>
            <Pressable onPress={handleRestore} disabled={isBusy || isLoadingPlans}>
              {isRestoring ? (
                <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
              ) : (
                <Text style={[styles.footerLinkText, { color: theme.colors.mutedForeground }]}>
                  Restore Purchases
                </Text>
              )}
            </Pressable>
            <Text style={[styles.footerLegalText, { color: theme.colors.mutedForeground }]}>
              By continuing, you agree to our privacy approach.
            </Text>
          </View>
        </Animated.View>
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
  backgroundBubbleTopRight: {
    position: "absolute",
    top: 118,
    right: -26,
    width: 150,
    height: 150,
    borderRadius: 999,
  },
  backgroundBubbleMidLeft: {
    position: "absolute",
    top: 340,
    left: -42,
    width: 110,
    height: 110,
    borderRadius: 999,
  },
  backgroundBubbleBottomRight: {
    position: "absolute",
    bottom: 116,
    right: -30,
    width: 126,
    height: 126,
    borderRadius: 999,
  },
  header: {
    alignItems: "flex-end",
    paddingTop: 8,
    paddingBottom: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
  },
  hero: {
    alignItems: "center",
    paddingTop: 2,
  },
  mascotWrap: {
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 12,
  },
  mascotHalo: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
  },
  mascot: {
    width: 92,
    height: 92,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 8,
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  previewCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 14,
  },
  previewBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  previewFeatureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  previewFeatureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  previewFeatureTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  previewFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  previewFooterText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dotActive: {
    width: 10,
    height: 10,
  },
  planRow: {
    flexDirection: "row",
    gap: 10,
  },
  planCardWrap: {
    flex: 1,
  },
  planCard: {
    minHeight: 110,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  planBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  planBadgeSpacer: {
    height: 18,
    marginBottom: 6,
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  planCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  planDuration: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  planTitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  planPrice: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },
  planSubtitle: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
  },
  footer: {
    backgroundColor: "#F6F7F2",
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10,
  },
  footerLinks: {
    alignItems: "center",
    gap: 4,
  },
  footerLinkText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footerLegalText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.88,
  },
  successContainer: {
    flex: 1,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
  },
  successBackgroundBubbleTop: {
    position: "absolute",
    top: 84,
    right: -44,
    width: 164,
    height: 164,
    borderRadius: 999,
  },
  successBackgroundBubbleMiddle: {
    position: "absolute",
    bottom: 142,
    left: -34,
    width: 96,
    height: 96,
    borderRadius: 999,
  },
  successContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 12,
  },
  successHero: {
    alignItems: "center",
  },
  successPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },
  successPillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  successMascotWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 18,
  },
  successMascotOrbit: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 999,
    borderWidth: 1,
  },
  successGlow: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 999,
  },
  successMascot: {
    width: 92,
    height: 92,
  },
  successCheck: {
    position: "absolute",
    right: 16,
    bottom: 14,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  successEyebrow: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  successTitle: {
    marginTop: 12,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  successText: {
    marginTop: 12,
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  successMetaBlock: {
    alignItems: "center",
    marginTop: 10,
  },
  successMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  successMetaPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  successMetaPrice: {
    fontSize: 13,
    fontWeight: "700",
  },
  successTagRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  successTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  successTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  successMicroNoteRow: {
    marginTop: 14,
  },
  successMicroNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  successMicroNoteText: {
    fontSize: 10,
    fontWeight: "700",
  },
  successFooter: {
    paddingTop: 10,
  },
});
