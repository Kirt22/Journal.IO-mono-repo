import { useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import {
  ArrowRight,
  CheckCircle2,
  Gift,
  X,
} from "lucide-react-native";
import {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
} from "react-native-purchases";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PrimaryButton from "../../components/PrimaryButton";
import {
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatOfferings,
  getRevenueCatPackagesForPlanKey,
  getRevenueCatPaywallPlans,
  hasPremiumAccess,
  purchaseRevenueCatPackage,
  refreshRevenueCatEntitlementState,
  restoreRevenueCatPurchases,
} from "../../services/revenueCatService";
import {
  getPaywallConfig,
  syncPaywallPurchase,
  trackPaywallEvent,
  type ResolvedPaywallConfig,
} from "../../services/paywallService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import {
  buildPaywallPlans,
  getPurchaseErrorMessage,
  isPurchasesError,
  type PaywallPlan,
} from "./paywallShared";

type DiscountOfferPaywallScreenProps = {
  onBack: () => void;
};

const EXIT_PLACEMENT_KEY = "post_auth_exit_offer";
const EXIT_OFFER_OFFERING_KEY = "yearly_exit_offer";
const FALLBACK_REGULAR_PRICE = "$59.99";

const parsePriceValue = (priceLabel?: string | null) => {
  if (!priceLabel) {
    return null;
  }

  const normalized = priceLabel.replace(/[^0-9.,]/g, "");

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(
    normalized.includes(".")
      ? normalized.replace(/,/g, "")
      : normalized.replace(",", ".")
  );

  return Number.isFinite(parsed) ? parsed : null;
};

const getCurrencySymbol = (priceLabel: string) =>
  priceLabel.match(/[^\d.,\s]/)?.[0] ?? "$";

const formatCurrencyValue = (symbol: string, amount: number) => `${symbol}${amount.toFixed(2)}`;

const getHighestPricedLabel = (
  priceLabels: Array<string | null | undefined>
) => {
  const sortedLabels = [...priceLabels]
    .filter((label): label is string => Boolean(label))
    .sort((left, right) => {
      const leftPrice = parsePriceValue(left);
      const rightPrice = parsePriceValue(right);

      if (leftPrice === null && rightPrice === null) {
        return 0;
      }

      if (leftPrice === null) {
        return 1;
      }

      if (rightPrice === null) {
        return -1;
      }

      return rightPrice - leftPrice;
    });

  return sortedLabels[0] ?? null;
};

const getPackageClosestToConfiguredPrice = (
  annualPackages: Array<{ product: { priceString: string } }>,
  configuredPriceLabel: string | null
) => {
  const configuredPriceValue = parsePriceValue(configuredPriceLabel);

  if (configuredPriceValue === null) {
    return annualPackages[0] ?? null;
  }

  return (
    [...annualPackages].sort((left, right) => {
      const leftPrice = parsePriceValue(left.product.priceString);
      const rightPrice = parsePriceValue(right.product.priceString);

      if (leftPrice === null && rightPrice === null) {
        return 0;
      }

      if (leftPrice === null) {
        return 1;
      }

      if (rightPrice === null) {
        return -1;
      }

      return (
        Math.abs(leftPrice - configuredPriceValue) -
        Math.abs(rightPrice - configuredPriceValue)
      );
    })[0] ?? null
  );
};

const getExitOfferPricing = (
  backendDiscountedPriceLabel: string | null,
  discountedPlan: PaywallPlan | null,
  regularAnnualPriceLabel: string | null
) => {
  const discountedPriceLabel =
    backendDiscountedPriceLabel || discountedPlan?.durationLabel || null;
  const regularPriceLabel =
    regularAnnualPriceLabel &&
    regularAnnualPriceLabel !== discountedPriceLabel
      ? regularAnnualPriceLabel
      : null;
  const discountedValue = parsePriceValue(discountedPriceLabel);
  const currencySymbol = getCurrencySymbol(
    discountedPriceLabel || regularPriceLabel || FALLBACK_REGULAR_PRICE
  );

  return {
    regularPriceLabel,
    discountedPriceLabel,
    monthlyEquivalentLabel:
      discountedValue !== null
        ? `${formatCurrencyValue(currencySymbol, discountedValue / 12)} / month`
        : null,
  };
};

export default function DiscountOfferPaywallScreen({
  onBack,
}: DiscountOfferPaywallScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const horizontalPadding = isCompact ? 18 : width > 430 ? 28 : 22;
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const isPremiumUser = useAppStore(state => Boolean(state.session?.user.isPremium));
  const activePaywallScreenKey = useAppStore(state => state.activePaywallScreenKey);
  const setSessionPremiumStatus = useAppStore(state => state.setSessionPremiumStatus);
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const [paywallConfig, setPaywallConfig] = useState<ResolvedPaywallConfig | null>(
    null
  );
  const [plans, setPlans] = useState<PaywallPlan[]>([]);
  const [plansError, setPlansError] = useState<string | null>(
    getRevenueCatConfigurationError()
  );
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [screenState, setScreenState] = useState<"offer" | "success">("offer");
  const [lastPurchaseStore, setLastPurchaseStore] = useState<string | null>(null);
  const [regularAnnualPriceLabel, setRegularAnnualPriceLabel] = useState<string | null>(
    null
  );
  const closeAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const actionAnim = useRef(new Animated.Value(0)).current;
  const iconFloatAnim = useRef(new Animated.Value(0)).current;
  const iconPulseAnim = useRef(new Animated.Value(0)).current;
  const ribbonPulseAnim = useRef(new Animated.Value(0)).current;
  const ctaPulseAnim = useRef(new Animated.Value(0)).current;
  const backgroundDriftAnim = useRef(new Animated.Value(0)).current;

  const plan = useMemo(
    () =>
      plans.find(candidate => candidate.offeringKey === EXIT_OFFER_OFFERING_KEY) ??
      plans.find(candidate => candidate.planKey === "annual") ??
      plans.find(candidate => candidate.offeringKey === "yearly") ??
      plans[0] ??
      null,
    [plans]
  );
  const backendDiscountedPriceLabel = useMemo(
    () =>
      paywallConfig?.offerings.find(
        offering => offering.key === EXIT_OFFER_OFFERING_KEY
      )?.price || null,
    [paywallConfig]
  );
  const pricing = useMemo(
    () =>
      getExitOfferPricing(
        backendDiscountedPriceLabel,
        plan,
        regularAnnualPriceLabel
      ),
    [backendDiscountedPriceLabel, plan, regularAnnualPriceLabel]
  );

  useEffect(() => {
    closeAnim.stopAnimation();
    heroAnim.stopAnimation();
    cardAnim.stopAnimation();
    actionAnim.stopAnimation();

    if (screenState !== "offer") {
      closeAnim.setValue(0);
      heroAnim.setValue(0);
      cardAnim.setValue(0);
      actionAnim.setValue(0);
      return;
    }

    closeAnim.setValue(0);
    heroAnim.setValue(0);
    cardAnim.setValue(0);
    actionAnim.setValue(0);

    const closeEntrance = Animated.timing(closeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const heroEntrance = Animated.timing(heroAnim, {
      toValue: 1,
      duration: 500,
      delay: 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const cardEntrance = Animated.timing(cardAnim, {
      toValue: 1,
      duration: 460,
      delay: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const actionEntrance = Animated.timing(actionAnim, {
      toValue: 1,
      duration: 420,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    closeEntrance.start();
    heroEntrance.start();
    cardEntrance.start();
    actionEntrance.start();

    return () => {
      closeEntrance.stop();
      heroEntrance.stop();
      cardEntrance.stop();
      actionEntrance.stop();
    };
  }, [actionAnim, cardAnim, closeAnim, heroAnim, screenState]);

  useEffect(() => {
    iconFloatAnim.stopAnimation();
    iconPulseAnim.stopAnimation();
    ribbonPulseAnim.stopAnimation();
    ctaPulseAnim.stopAnimation();
    backgroundDriftAnim.stopAnimation();

    if (screenState !== "offer") {
      iconFloatAnim.setValue(0);
      iconPulseAnim.setValue(0);
      ribbonPulseAnim.setValue(0);
      ctaPulseAnim.setValue(0);
      backgroundDriftAnim.setValue(0);
      return;
    }

    iconFloatAnim.setValue(0);
    iconPulseAnim.setValue(0);
    ribbonPulseAnim.setValue(0);
    ctaPulseAnim.setValue(0);
    backgroundDriftAnim.setValue(0);

    const iconFloatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloatAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconFloatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const iconPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulseAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const ribbonPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(ribbonPulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ribbonPulseAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ])
    );

    const backgroundDriftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundDriftAnim, {
          toValue: 1,
          duration: 4800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(backgroundDriftAnim, {
          toValue: 0,
          duration: 4800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const ctaPulseLoop =
      !isProcessing && !isRestoring
        ? Animated.loop(
            Animated.sequence([
              Animated.delay(800),
              Animated.timing(ctaPulseAnim, {
                toValue: 1,
                duration: 1100,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(ctaPulseAnim, {
                toValue: 0,
                duration: 1100,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.delay(1400),
            ])
          )
        : null;

    iconFloatLoop.start();
    iconPulseLoop.start();
    ribbonPulseLoop.start();
    backgroundDriftLoop.start();
    ctaPulseLoop?.start();

    return () => {
      iconFloatLoop.stop();
      iconPulseLoop.stop();
      ribbonPulseLoop.stop();
      backgroundDriftLoop.stop();
      ctaPulseLoop?.stop();
    };
  }, [
    backgroundDriftAnim,
    ctaPulseAnim,
    iconFloatAnim,
    iconPulseAnim,
    isProcessing,
    isRestoring,
    ribbonPulseAnim,
    screenState,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadPaywall = async () => {
      setIsLoadingPlans(true);
      setPlansError(getRevenueCatConfigurationError());

      try {
        const resolvedConfig = sessionUserId
          ? await getPaywallConfig({
              placementKey: EXIT_PLACEMENT_KEY,
              screenKey: activePaywallScreenKey || undefined,
              triggerMode: "contextual",
            })
          : null;

        if (!isMounted) {
          return;
        }

        if (resolvedConfig) {
          setPaywallConfig(resolvedConfig);
        }

        if (resolvedConfig && !resolvedConfig.shouldShow) {
          onBack();
          return;
        }

        const offerings = await getRevenueCatOfferings(sessionUserId);
        const annualPackages = getRevenueCatPackagesForPlanKey(offerings, "annual");
        const livePlans = getRevenueCatPaywallPlans(
          offerings,
          resolvedConfig?.offerings
        );
        const nextPlans = buildPaywallPlans(livePlans, resolvedConfig).filter(
          candidate =>
            candidate.offeringKey === EXIT_OFFER_OFFERING_KEY ||
            candidate.planKey === "annual" ||
            candidate.offeringKey === "yearly"
        );

        if (!isMounted) {
          return;
        }

        setPlans(nextPlans);
        setRegularAnnualPriceLabel(
          getHighestPricedLabel(
            annualPackages.map(rcPackage => rcPackage.product.priceString)
          )
        );
        setPlansError(
          nextPlans.some(candidate => candidate.rcPackage)
            ? null
            : "A live exit-offer yearly package is not available for this offer yet."
        );

        if (resolvedConfig?.template) {
          trackPaywallEvent({
            placementKey: resolvedConfig.placementKey,
            screenKey: resolvedConfig.screenKey || undefined,
            eventType: "paywall_impression",
            templateKey: resolvedConfig.template.key,
            offeringKey: nextPlans[0]?.offeringKey,
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
            : "We could not load the special exit offer right now."
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
  }, [activePaywallScreenKey, onBack, sessionUserId]);

  useEffect(() => {
    if (isPremiumUser) {
      setScreenState("success");
    }
  }, [isPremiumUser]);

  const trackEvent = (
    eventType:
      | "paywall_dismiss"
      | "cta_tap"
      | "purchase_success"
      | "restore_success"
      | "purchase_failure"
  ) => {
    if (!paywallConfig?.template) {
      return;
    }

    trackPaywallEvent({
      placementKey: paywallConfig.placementKey,
      screenKey: paywallConfig.screenKey || undefined,
      eventType,
      templateKey: paywallConfig.template.key,
      offeringKey: plan?.offeringKey,
      wasInterruptive: paywallConfig.wasInterruptive,
    }).catch(() => undefined);
  };

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
      setScreenState("success");
      return true;
    }

    const updatedProfile = await syncPaywallPurchase({
      offeringKey: targetPlan.offeringKey,
      revenueCatOfferingId: targetPlan.revenueCatOfferingId || EXIT_PLACEMENT_KEY,
      revenueCatPackageId:
        targetPlan.revenueCatPackageId ||
        targetPlan.rcPackage?.identifier ||
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

  const handleDismiss = () => {
    trackEvent("paywall_dismiss");
    onBack();
  };

  const handleUpgrade = async () => {
    let purchasePackage = plan?.rcPackage ?? null;

    if (sessionUserId) {
      const liveOfferings = await getRevenueCatOfferings(sessionUserId).catch(
        () => null
      );
      const annualPackages = getRevenueCatPackagesForPlanKey(
        liveOfferings,
        "annual"
      );
      const matchedExitPackage = getPackageClosestToConfiguredPrice(
        annualPackages,
        backendDiscountedPriceLabel
      );

      if (matchedExitPackage) {
        purchasePackage = matchedExitPackage;
      }
    }

    if (!purchasePackage) {
      Alert.alert(
        "Billing unavailable",
        plansError ||
          "A live exit-offer yearly package is not available for this offer yet."
      );
      return;
    }

    setIsProcessing(true);

    try {
      trackEvent("cta_tap");
      const purchaseResult = await purchaseRevenueCatPackage(
        purchasePackage,
        sessionUserId
      );
      const activated = await finalizePremiumActivation(
        purchaseResult.customerInfo,
        plan
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

      if (paywallConfig?.template) {
        trackPaywallEvent({
          placementKey: paywallConfig.placementKey,
          screenKey: paywallConfig.screenKey || undefined,
          eventType: "purchase_failure",
          templateKey: paywallConfig.template.key,
          offeringKey: plan.offeringKey,
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
    if (!plan) {
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

      await finalizePremiumActivation(customerInfo, plan, { wasRestore: true });
      trackEvent("restore_success");
    } catch (error) {
      Alert.alert("Restore purchases", getPurchaseErrorMessage(error));
    } finally {
      setIsRestoring(false);
    }
  };

  const isBusy = isProcessing || isRestoring;

  return (
    <SafeAreaView
      edges={[]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.container}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.backgroundGradientTop,
              { backgroundColor: `${theme.colors.primary}0D` },
            ]}
          />
          <Animated.View
            style={[
              styles.backgroundGlowTop,
              {
                backgroundColor: `${theme.colors.primary}1C`,
                transform: [
                  {
                    translateX: backgroundDriftAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -18],
                    }),
                  },
                  {
                    translateY: backgroundDriftAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 14],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.backgroundGlowBottom,
              {
                backgroundColor: `${theme.colors.accent}F2`,
                transform: [
                  {
                    translateX: backgroundDriftAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 14],
                    }),
                  },
                  {
                    translateY: backgroundDriftAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -12],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        {screenState === "success" ? (
          <View
            style={[
              styles.successWrap,
              {
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                paddingHorizontal: horizontalPadding,
              },
            ]}
          >
            <View
              style={[
                styles.successCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.successIconWrap,
                  { backgroundColor: `${theme.colors.success}18` },
                ]}
              >
                <CheckCircle2 size={28} color={theme.colors.success} />
              </View>
              <Text style={[styles.successTitle, { color: theme.colors.foreground }]}>
                Premium is active
              </Text>
              <Text
                style={[styles.successBody, { color: theme.colors.mutedForeground }]}
              >
                {lastPurchaseStore === "TEST_STORE"
                  ? "The test purchase is active. You can continue into Journal.IO."
                  : "Your yearly premium access is now active on this account."}
              </Text>
              <PrimaryButton label="Continue" onPress={onBack} tone="accent" />
            </View>
          </View>
        ) : (
          <>
            <Animated.View
              style={[
                styles.header,
                {
                  paddingTop: insets.top + 6,
                  paddingHorizontal: horizontalPadding,
                  opacity: closeAnim,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decline offer"
                onPress={handleDismiss}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: `${theme.colors.secondary}D9`,
                    borderColor: `${theme.colors.border}CC`,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <X size={20} color={theme.colors.mutedForeground} />
              </Pressable>
            </Animated.View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingTop: Math.max(insets.top, 12),
                  paddingBottom: insets.bottom + 36,
                  paddingHorizontal: horizontalPadding,
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.contentCenter}>
                <Animated.View
                  style={[
                    styles.heroBlock,
                    {
                      opacity: heroAnim,
                      transform: [
                        {
                          scale: heroAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                        {
                          translateY: heroAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [18, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.heroIconWrap,
                      {
                        backgroundColor: `${theme.colors.primary}12`,
                        borderColor: `${theme.colors.primary}20`,
                        transform: [
                          {
                            translateY: iconFloatAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -8],
                            }),
                          },
                          {
                            scale: iconFloatAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.02],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.heroIconPulse,
                        {
                          backgroundColor: `${theme.colors.primary}10`,
                          opacity: iconPulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.35, 0.75],
                          }),
                          transform: [
                            {
                              scale: iconPulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.12],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                    <Gift size={48} color={theme.colors.primary} strokeWidth={1.6} />
                  </Animated.View>

                  <Text style={[styles.title, { color: theme.colors.foreground }]}>
                    Wait! Don&apos;t go.
                  </Text>

                  <Text
                    style={[styles.subtitle, { color: theme.colors.mutedForeground }]}
                  >
                    Get{" "}
                    <Text
                      style={[styles.subtitleHighlight, { color: theme.colors.primary }]}
                    >
                      50% OFF
                    </Text>{" "}
                    your first year of Journal.IO Premium. Unlock all premium
                    features and start your journey today.
                  </Text>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.offerCard,
                    {
                      backgroundColor: `${theme.colors.card}E6`,
                      borderColor: `${theme.colors.primary}22`,
                      shadowColor: theme.colors.primary,
                      opacity: cardAnim,
                      transform: [
                        {
                          translateY: cardAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [22, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.ribbon,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: ribbonPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.86],
                        }),
                        transform: [
                          {
                            scale: ribbonPulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.04],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ribbonText,
                        { color: theme.colors.primaryForeground },
                      ]}
                    >
                      LIMITED TIME
                    </Text>
                  </Animated.View>

                  <Text style={[styles.offerTitle, { color: theme.colors.foreground }]}>
                    Yearly Premium
                  </Text>

                  <View style={styles.offerPriceRow}>
                    {pricing.regularPriceLabel ? (
                      <Text
                        style={[
                          styles.oldPrice,
                          { color: `${theme.colors.mutedForeground}CC` },
                        ]}
                      >
                        {pricing.regularPriceLabel}
                      </Text>
                    ) : null}
                    <Text style={[styles.newPrice, { color: theme.colors.primary }]}>
                      {pricing.discountedPriceLabel ||
                        plan?.durationLabel ||
                        FALLBACK_REGULAR_PRICE}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.offerCaption,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {pricing.monthlyEquivalentLabel
                      ? `That's just ${pricing.monthlyEquivalentLabel}`
                      : "A calmer premium rhythm for steady journaling."}
                  </Text>
                </Animated.View>
              </View>

              {plansError ? (
                <View
                  style={[
                    styles.messageCard,
                    {
                      backgroundColor: `${theme.colors.warning}12`,
                      borderColor: `${theme.colors.warning}32`,
                    },
                  ]}
                >
                  <Text style={[styles.messageText, { color: theme.colors.foreground }]}>
                    {plansError}
                  </Text>
                </View>
              ) : null}

              <Animated.View
                style={[
                  styles.actions,
                  {
                    opacity: actionAnim,
                    transform: [
                      {
                        translateY: actionAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [18, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: ctaPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.018],
                        }),
                      },
                    ],
                  }}
                >
                  <PrimaryButton
                    label={isProcessing ? "Processing..." : "Claim 50% Off"}
                    onPress={() => {
                      handleUpgrade().catch(() => undefined);
                    }}
                    loading={isProcessing}
                    tone="accent"
                    icon={<ArrowRight size={18} color={theme.colors.primaryForeground} />}
                    disabled={!plan?.rcPackage || isLoadingPlans || isRestoring}
                  />
                </Animated.View>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleDismiss}
                  disabled={isBusy}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text
                    style={[
                      styles.declineText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    No thanks, I&apos;ll pass on this discount
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    handleRestore().catch(() => undefined);
                  }}
                  disabled={isBusy || isLoadingPlans}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  {isRestoring ? (
                    <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
                  ) : (
                    <Text
                      style={[
                        styles.restoreText,
                        { color: `${theme.colors.mutedForeground}B3` },
                      ]}
                    >
                      Restore purchases
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
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
    overflow: "hidden",
  },
  backgroundGradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -120,
    right: -140,
    width: 380,
    height: 380,
    borderRadius: 190,
  },
  backgroundGlowBottom: {
    position: "absolute",
    bottom: -120,
    left: -110,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  header: {
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: "flex-end",
    zIndex: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingBottom: 36,
  },
  contentCenter: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    width: "100%",
    marginTop: -6,
  },
  heroBlock: {
    width: "100%",
    maxWidth: 332,
    alignItems: "center",
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    overflow: "visible",
  },
  heroIconPulse: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 32,
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
  },
  subtitleHighlight: {
    fontWeight: "800",
  },
  offerCard: {
    width: "100%",
    maxWidth: 332,
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 28,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 202,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
    overflow: "hidden",
  },
  ribbon: {
    position: "absolute",
    top: 0,
    right: 0,
    borderBottomLeftRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  ribbonText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  offerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  offerPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 12,
    marginBottom: 14,
  },
  oldPrice: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    textDecorationLine: "line-through",
  },
  newPrice: {
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "900",
    letterSpacing: -2,
  },
  offerCaption: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: 16,
    paddingTop: 28,
    paddingBottom: 10,
  },
  declineText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  restoreText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  messageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
  successWrap: {
    flex: 1,
    justifyContent: "center",
  },
  successCard: {
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  successIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  successBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.9,
  },
});
