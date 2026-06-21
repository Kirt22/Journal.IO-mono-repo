import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, {
  CustomVariableValue,
  type CustomVariables,
} from "react-native-purchases-ui";
import { ShieldCheck, Sparkles } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActionSuccessScreen from "../../components/ActionSuccessScreen";
import {
  REVENUECAT_OFFERINGS,
  REVENUECAT_PRODUCTS,
  REVENUECAT_SUMMER_PAYWALL_VARIABLES,
} from "../../config/revenueCat";
import {
  getRevenueCatHostedOffering,
  getRevenueCatPurchaseAttribution,
  hasPremiumAccess,
  hasRevenueCatHostedPaywall,
  getPackageByProductId,
  refreshRevenueCatEntitlementState,
  type RevenueCatHostedPaywallTarget,
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
  type PaywallOffering,
  type ResolvedPaywallConfig,
} from "../../services/paywallService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import {
  getPurchaseErrorMessage,
  NO_RESTORED_PURCHASE_MESSAGE,
  NO_RESTORED_PURCHASE_TITLE,
  PURCHASE_UPDATING_SUCCESS_MESSAGE,
  PURCHASE_UPDATING_SUCCESS_TITLE,
} from "./paywallShared";

type ScreenState = "launching" | "success";

type HostedPaywallLoadState = {
  offering: PurchasesOffering | null;
  offerings: PurchasesOfferings | null;
  customVariables: CustomVariables | undefined;
  isReady: boolean;
};

const getDefaultPlacementKey = (target: RevenueCatHostedPaywallTarget) =>
  target === "exit" ? "post_auth_exit_offer" : "post_auth";

const getSurfaceLabel = (target: RevenueCatHostedPaywallTarget) =>
  target === "exit" ? "hosted_exit" : "hosted_main";

const logSummerPaywallPricing = ({
  discountPackage,
  normalYearlyPackage,
  canCompareYearlyPrices,
  normalYearlyPriceVariable,
}: {
  discountPackage: PurchasesPackage | null;
  normalYearlyPackage: PurchasesPackage | null;
  canCompareYearlyPrices: boolean;
  normalYearlyPriceVariable: string;
}) => {
  if (!__DEV__) {
    return;
  }

  console.info("[RevenueCatDebug] summer paywall pricing variables", {
    discountProduct: discountPackage
      ? {
          productIdentifier: discountPackage.product.identifier,
          packageIdentifier: discountPackage.identifier,
          price: discountPackage.product.price,
          priceString: discountPackage.product.priceString,
          currencyCode: discountPackage.product.currencyCode,
        }
      : null,
    normalYearlyProduct: normalYearlyPackage
      ? {
          productIdentifier: normalYearlyPackage.product.identifier,
          packageIdentifier: normalYearlyPackage.identifier,
          price: normalYearlyPackage.product.price,
          priceString: normalYearlyPackage.product.priceString,
          currencyCode: normalYearlyPackage.product.currencyCode,
        }
      : null,
    canCompareYearlyPrices,
    customVariables: {
      [REVENUECAT_SUMMER_PAYWALL_VARIABLES.NORMAL_YEARLY_PRICE]:
        normalYearlyPriceVariable,
    },
  });
};

const syncHostedTrialReminder = (
  target: RevenueCatHostedPaywallTarget,
  premiumExpiresAt: string | null | undefined,
  premiumWillRenew: boolean | null | undefined,
  matchedPackage: PurchasesPackage | null,
  options: { wasRestore?: boolean } = {}
) => {
  const hasFreeTrial =
    target === "main" &&
    !options.wasRestore &&
    premiumWillRenew !== false &&
    matchedPackage?.packageType === PACKAGE_TYPE.ANNUAL &&
    matchedPackage.product.introPrice?.price === 0;

  if (!hasFreeTrial) {
    cancelFreeTrialEndingReminder().catch(() => undefined);
    return;
  }

  scheduleFreeTrialEndingReminder(premiumExpiresAt).catch(() => undefined);
};

export default function HostedRevenueCatPaywallScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const activeHostedPaywallTarget = useAppStore(
    state => state.activeHostedPaywallTarget
  );
  const activePaywallPlacementKey = useAppStore(
    state => state.activePaywallPlacementKey
  );
  const activePaywallScreenKey = useAppStore(state => state.activePaywallScreenKey);
  const activePaywallTriggerMode = useAppStore(
    state => state.activePaywallTriggerMode
  );
  const continueFromHostedPaywall = useAppStore(
    state => state.continueFromHostedPaywall
  );
  const fallbackFromHostedPaywall = useAppStore(
    state => state.fallbackFromHostedPaywall
  );
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const [screenState, setScreenState] = useState<ScreenState>("launching");
  const [lastPurchaseStore, setLastPurchaseStore] = useState<string | null>(null);
  const [isPurchaseAccessUpdating, setIsPurchaseAccessUpdating] = useState(false);
  const [hostedPaywallState, setHostedPaywallState] =
    useState<HostedPaywallLoadState>({
      offering: null,
      offerings: null,
      customVariables: undefined,
      isReady: false,
    });
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const iconEntrance = useRef(new Animated.Value(0)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;
  const copyEntrance = useRef(new Animated.Value(0)).current;
  const paywallConfigRef = useRef<ResolvedPaywallConfig | null>(null);
  const didCompleteHostedActionRef = useRef(false);
  const isHostedActionInProgressRef = useRef(false);
  const hostedTargetRef = useRef(activeHostedPaywallTarget ?? "main");
  const paywallContextRef = useRef({
    placementKey:
      activePaywallPlacementKey ||
      getDefaultPlacementKey(hostedTargetRef.current),
    screenKey: activePaywallScreenKey || null,
    triggerMode: activePaywallTriggerMode,
  });

  const hostedTarget = hostedTargetRef.current;
  const hostedPlacementKey = paywallContextRef.current.placementKey;
  const hostedScreenKey = paywallContextRef.current.screenKey;
  const hostedTriggerMode = paywallContextRef.current.triggerMode;
  const isExitOffer = hostedTarget === "exit";
  const horizontalPadding = width >= 430 ? 30 : width < 360 ? 20 : 24;
  const maxWidth = width >= 430 ? 430 : 400;
  const launchTitle = isExitOffer
    ? "Opening your special yearly offer"
    : "Opening secure checkout";
  const launchBody = isExitOffer
    ? "We are preparing the localized App Store pricing now."
    : "We are loading the RevenueCat paywall for this step.";

  const trackEvent = useCallback((
    eventType:
      | "paywall_impression"
      | "paywall_dismiss"
      | "cta_tap"
      | "purchase_success"
      | "restore_success"
      | "purchase_failure",
    metadata?: Record<string, unknown>,
    offeringKey?: PaywallOffering["key"]
  ) => {
    const activePaywallConfig = paywallConfigRef.current;

    if (!activePaywallConfig?.template) {
      return;
    }

    trackPaywallEvent({
      placementKey: activePaywallConfig.placementKey,
      screenKey: activePaywallConfig.screenKey || undefined,
      eventType,
      templateKey: activePaywallConfig.template.key,
      offeringKey,
      wasInterruptive: activePaywallConfig.wasInterruptive,
      metadata: {
        surface: getSurfaceLabel(hostedTarget),
        ...metadata,
      },
    }).catch(() => undefined);
  }, [hostedTarget]);

  useEffect(() => {
    iconEntrance.setValue(0);
    copyEntrance.setValue(0);
    iconFloat.setValue(0);

    const entrance = Animated.stagger(90, [
      Animated.timing(iconEntrance, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(copyEntrance, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloat, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    floatLoop.start();

    return () => {
      entrance.stop();
      floatLoop.stop();
    };
  }, [copyEntrance, iconEntrance, iconFloat]);

  const completePremiumActivation = useCallback(async (
    customerInfo: CustomerInfo,
    offerings: PurchasesOfferings | null,
    options: { wasRestore?: boolean } = {}
  ) => {
    const premiumAccess = hasPremiumAccess(customerInfo);
    const attribution = getRevenueCatPurchaseAttribution(
      customerInfo,
      offerings
    );

    if (!premiumAccess || !attribution) {
      return false;
    }

    setLastPurchaseStore(attribution.activeEntitlement.store ?? null);

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
    syncHostedTrialReminder(
      hostedTarget,
      updatedProfile.premiumExpiresAt,
      updatedProfile.premiumWillRenew,
      attribution.rcPackage,
      options
    );
    setIsPurchaseAccessUpdating(false);
    setScreenState("success");
    return true;
  }, [
    hostedTarget,
    setSessionUserProfile,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadHostedPaywall = async () => {
      if (!hasRevenueCatHostedPaywall(hostedTarget)) {
        fallbackFromHostedPaywall();
        return;
      }

      const resolvedConfig = sessionUserId
        ? await getPaywallConfig({
            placementKey: hostedPlacementKey,
            screenKey: hostedScreenKey || undefined,
            triggerMode: hostedTriggerMode,
          })
        : null;

      if (!isMounted) {
        return;
      }

      if (resolvedConfig) {
        paywallConfigRef.current = resolvedConfig;
      }

      if (resolvedConfig && !resolvedConfig.shouldShow) {
        continueFromHostedPaywall("continue");
        return;
      }

      if (resolvedConfig?.template) {
        trackPaywallEvent({
          placementKey: resolvedConfig.placementKey,
          screenKey: resolvedConfig.screenKey || undefined,
          eventType: "paywall_impression",
          templateKey: resolvedConfig.template.key,
          offeringKey: resolvedConfig.offerings[0]?.key,
          wasInterruptive: resolvedConfig.wasInterruptive,
          metadata: {
            surface: getSurfaceLabel(hostedTarget),
          },
        }).catch(() => undefined);
      }

      const hostedResult = await getRevenueCatHostedOffering(
        hostedTarget,
        hostedPlacementKey,
        sessionUserId
      );

      if (!isMounted) {
        return;
      }

      if (!hostedResult.offering) {
        fallbackFromHostedPaywall();
        return;
      }

      const discountPackage =
        hostedTarget === "exit"
          ? getPackageByProductId(
              hostedResult.offerings,
              REVENUECAT_OFFERINGS.SUMMER_OFFER,
              REVENUECAT_PRODUCTS.YEARLY_DISCOUNT
            )
          : null;
      const normalYearlyPackage =
        hostedTarget === "exit"
          ? getPackageByProductId(
              hostedResult.offerings,
              REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD,
              REVENUECAT_PRODUCTS.YEARLY
            )
          : null;
      const canCompareYearlyPrices = Boolean(
        discountPackage?.product.currencyCode &&
          normalYearlyPackage?.product.currencyCode &&
          discountPackage.product.currencyCode ===
            normalYearlyPackage.product.currencyCode
      );
      const normalYearlyPriceVariable = canCompareYearlyPrices
        ? normalYearlyPackage?.product.priceString || ""
        : "";
      const customVariables =
        hostedTarget === "exit"
          ? {
              [REVENUECAT_SUMMER_PAYWALL_VARIABLES.NORMAL_YEARLY_PRICE]:
                CustomVariableValue.string(normalYearlyPriceVariable),
            }
          : undefined;

      if (hostedTarget === "exit") {
        logSummerPaywallPricing({
          discountPackage,
          normalYearlyPackage,
          canCompareYearlyPrices,
          normalYearlyPriceVariable,
        });
      }

      setHostedPaywallState({
        offering: hostedResult.offering,
        offerings: hostedResult.offerings,
        customVariables,
        isReady: true,
      });
    };

    loadHostedPaywall().catch(error => {
      if (!isMounted) {
        return;
      }

      trackEvent("purchase_failure", {
        message: error instanceof Error ? error.message : "Hosted paywall failed.",
      });
      fallbackFromHostedPaywall();
    });

    return () => {
      isMounted = false;
    };
  }, [
    continueFromHostedPaywall,
    fallbackFromHostedPaywall,
    hostedPlacementKey,
    hostedScreenKey,
    hostedTarget,
    hostedTriggerMode,
    sessionUserId,
    trackEvent,
  ]);

  const finalizeHostedPurchase = useCallback(
    async (
      customerInfo: CustomerInfo,
      offerings: PurchasesOfferings | null,
      options: { wasRestore?: boolean } = {}
    ) => {
      setProcessingLabel("Finalizing your access...");

      try {
        const activated = await completePremiumActivation(
          customerInfo,
          offerings,
          options
        );

        if (!activated && sessionUserId) {
          const refreshedEntitlementState = await refreshRevenueCatEntitlementState(
            sessionUserId
          );

          if (refreshedEntitlementState.customerInfo) {
            const refreshedActivated = await completePremiumActivation(
              refreshedEntitlementState.customerInfo,
              offerings,
              options
            );

            if (refreshedActivated) {
              trackEvent(
                options.wasRestore ? "restore_success" : "purchase_success"
              );
              return true;
            }
          }
        }

        if (!activated) {
          if (options.wasRestore) {
            Alert.alert(
              NO_RESTORED_PURCHASE_TITLE,
              NO_RESTORED_PURCHASE_MESSAGE
            );
            trackEvent("purchase_failure", {
              action: "restore",
              message: NO_RESTORED_PURCHASE_MESSAGE,
            });
            return false;
          }

          setIsPurchaseAccessUpdating(true);
          setScreenState("success");
          trackEvent("purchase_success", {
            activationPending: true,
          });
          return true;
        }

        trackEvent(options.wasRestore ? "restore_success" : "purchase_success");
        return true;
      } finally {
        setProcessingLabel(null);
      }
    },
    [
      completePremiumActivation,
      sessionUserId,
      trackEvent,
    ]
  );

  const handleHostedPurchaseStarted = useCallback(
    ({ packageBeingPurchased }: { packageBeingPurchased: PurchasesPackage }) => {
      isHostedActionInProgressRef.current = true;
      setProcessingLabel("Processing your purchase...");
      trackEvent(
        "cta_tap",
        {
          action: "purchase",
          packageId: packageBeingPurchased.identifier,
        },
        hostedTarget === "exit"
          ? "yearly_exit_offer"
          : packageBeingPurchased.packageType === PACKAGE_TYPE.WEEKLY
            ? "weekly"
            : "yearly"
      );
    },
    [hostedTarget, trackEvent]
  );

  const handleHostedRestoreStarted = useCallback(() => {
    isHostedActionInProgressRef.current = true;
    setProcessingLabel("Restoring your purchase...");
    trackEvent(
      "cta_tap",
      {
        action: "restore",
      },
      paywallConfigRef.current?.offerings[0]?.key
    );
  }, [trackEvent]);

  const handleHostedDismiss = useCallback(() => {
    if (
      didCompleteHostedActionRef.current ||
      isHostedActionInProgressRef.current
    ) {
      return;
    }

    setProcessingLabel(null);
    trackEvent("paywall_dismiss");
    continueFromHostedPaywall("dismiss");
  }, [continueFromHostedPaywall, trackEvent]);

  const handleHostedPurchaseCancelled = useCallback(() => {
    isHostedActionInProgressRef.current = false;
    setProcessingLabel(null);
  }, []);

  const handleHostedPurchaseError = useCallback(
    ({ error }: { error: unknown }) => {
      isHostedActionInProgressRef.current = false;
      setProcessingLabel(null);
      const message = getPurchaseErrorMessage(error);

      trackEvent("purchase_failure", {
        message,
      });
      Alert.alert("Purchase not completed", message);
    },
    [trackEvent]
  );

  const handleHostedPurchaseCompleted = useCallback(
    async ({
      customerInfo,
    }: {
      customerInfo: CustomerInfo;
      storeTransaction: unknown;
    }) => {
      isHostedActionInProgressRef.current = true;
      const activated = await finalizeHostedPurchase(
        customerInfo,
        hostedPaywallState.offerings,
        {
          wasRestore: false,
        }
      );

      if (activated) {
        didCompleteHostedActionRef.current = true;
        return;
      }

      isHostedActionInProgressRef.current = false;
    },
    [finalizeHostedPurchase, hostedPaywallState.offerings]
  );

  const handleHostedRestoreCompleted = useCallback(
    async ({ customerInfo }: { customerInfo: CustomerInfo }) => {
      isHostedActionInProgressRef.current = true;
      const activated = await finalizeHostedPurchase(
        customerInfo,
        hostedPaywallState.offerings,
        {
          wasRestore: true,
        }
      );

      if (activated) {
        didCompleteHostedActionRef.current = true;
        return;
      }

      isHostedActionInProgressRef.current = false;
    },
    [finalizeHostedPurchase, hostedPaywallState.offerings]
  );

  const handleHostedRestoreError = useCallback(
    ({ error }: { error: unknown }) => {
      isHostedActionInProgressRef.current = false;
      setProcessingLabel(null);
      const message = getPurchaseErrorMessage(error);

      trackEvent("purchase_failure", {
        message,
      });
      Alert.alert("Restore unavailable", message);
    },
    [trackEvent]
  );

  const iconTranslateY = useMemo(
    () =>
      iconFloat.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
      }),
    [iconFloat]
  );

  if (screenState === "success") {
    return (
      <ActionSuccessScreen
        variant="payment"
        title={
          isPurchaseAccessUpdating
            ? PURCHASE_UPDATING_SUCCESS_TITLE
            : "You're Premium"
        }
        subtitle={
          isPurchaseAccessUpdating
            ? PURCHASE_UPDATING_SUCCESS_MESSAGE
            : lastPurchaseStore === "TEST_STORE"
            ? "Your premium access is ready. You can continue into Journal.IO."
            : "Your premium access is now active on this account."
        }
        buttonLabel="Continue"
        onPrimaryAction={() => continueFromHostedPaywall("continue")}
      />
    );
  }

  if (!hostedPaywallState.isReady || !hostedPaywallState.offering) {
    return (
      <View style={[styles.screenRoot, { backgroundColor: theme.colors.background }]}>
        <View
          style={[
            styles.root,
            {
              paddingTop: insets.top + 18,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                maxWidth,
                opacity: copyEntrance,
                transform: [
                  {
                    translateY: copyEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.border,
                  opacity: iconEntrance,
                  transform: [{ translateY: iconTranslateY }],
                },
              ]}
            >
              {isExitOffer ? (
                <Sparkles size={34} color={theme.colors.primary} strokeWidth={1.9} />
              ) : (
                <ShieldCheck
                  size={34}
                  color={theme.colors.primary}
                  strokeWidth={1.9}
                />
              )}
            </Animated.View>

            <Text style={[styles.title, { color: theme.colors.foreground }]}>
              {launchTitle}
            </Text>
            <Text
              style={[styles.body, { color: theme.colors.mutedForeground }]}
            >
              {launchBody}
            </Text>

            <View
              style={[
                styles.progressCard,
                {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <ActivityIndicator color={theme.colors.primary} />
              <Text
                style={[styles.progressText, { color: theme.colors.foreground }]}
              >
                RevenueCat is preparing the checkout surface.
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
      <View style={[styles.screenRoot, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.paywallRoot, { backgroundColor: theme.colors.background }]}>
          <RevenueCatUI.Paywall
            style={styles.paywallSurface}
            options={{
              offering: hostedPaywallState.offering,
              displayCloseButton: true,
              customVariables: hostedPaywallState.customVariables,
            }}
            onPurchaseStarted={handleHostedPurchaseStarted}
            onPurchaseCompleted={handleHostedPurchaseCompleted}
            onPurchaseCancelled={handleHostedPurchaseCancelled}
            onPurchaseError={handleHostedPurchaseError}
            onRestoreStarted={handleHostedRestoreStarted}
            onRestoreCompleted={handleHostedRestoreCompleted}
            onRestoreError={handleHostedRestoreError}
            onDismiss={handleHostedDismiss}
          />

          {processingLabel ? (
            <View
              pointerEvents="auto"
              style={[
                styles.processingOverlay,
                {
                  backgroundColor: theme.colors.background,
                },
              ]}
            >
              <View
                style={[
                  styles.processingCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <ActivityIndicator color={theme.colors.primary} />
                <Text
                  style={[
                    styles.processingTitle,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {processingLabel}
                </Text>
                <Text
                  style={[
                    styles.processingBody,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  RevenueCat is confirming the payment.
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  progressCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 6,
  },
  progressText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  paywallRoot: {
    flex: 1,
  },
  paywallSurface: {
    flex: 1,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  processingCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: "center",
    gap: 10,
  },
  processingTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  processingBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
