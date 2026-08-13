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
import { X } from "lucide-react-native";
import {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ActionSuccessScreen from "../../components/ActionSuccessScreen";
import ButtonLoadingContent from "../../components/ButtonLoadingContent";
import JournalLoader from '../../components/JournalLoader';
import PriceText from "../../components/PriceText";
import {
  REVENUECAT_OFFERINGS,
  REVENUECAT_PRODUCTS,
} from "../../config/revenueCat";
import { triggerHaptic } from "../../services/hapticsService";
import {
  getPackageByProductId,
  getRevenueCatActiveEntitlement,
  getRevenueCatConfigurationError,
  getRevenueCatOfferings,
  getRevenueCatPurchaseAttribution,
  hasPremiumAccess,
  purchaseRevenueCatPackage,
  refreshRevenueCatEntitlementState,
  resolveProductPriceString,
  restoreRevenueCatPurchases,
} from "../../services/revenueCatService";
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
  getPurchaseErrorMessage,
  isPurchasesError,
  NO_RESTORED_PURCHASE_MESSAGE,
  NO_RESTORED_PURCHASE_TITLE,
  PURCHASE_UPDATING_SUCCESS_MESSAGE,
  PURCHASE_UPDATING_SUCCESS_TITLE,
} from "./paywallShared";
import { getPaywallContent } from "./paywallContent";

type YearlyOfferPaywallScreenProps = {
  /** `continue` means premium is active; `dismiss` means the user backed out. */
  onBack: (reason?: "dismiss" | "continue") => void;
  /** Called when the discounted package can't be resolved at all. */
  onUnavailable?: () => void;
};

type ScreenState = "offer" | "success";

const OFFER_ICON = require("../../assets/png/paywall/icons8-offer-64.png");

const PLACEMENT_KEY = "post_auth_exit_offer";
const SCREEN_KEY = "home";
const OFFERING_KEY = "yearly_exit_offer";

const OFFER_UNAVAILABLE_MESSAGE =
  "This offer is not available right now. Please try again a little later.";

/** Ink, not `foreground` — a light shadow on dark would halo, not deepen. */
const PAYWALL_SHADOW_COLOR = "#000000";

type OfferPricing = {
  discountPackage: PurchasesPackage | null;
  discountPrice: string;
  /**
   * The undiscounted yearly price, struck through beside the offer price. Empty
   * whenever it can't be shown truthfully — see `loadOffer`.
   */
  standardPrice: string;
};

const EMPTY_PRICING: OfferPricing = {
  discountPackage: null,
  discountPrice: "",
  standardPrice: "",
};

/**
 * The special yearly offer, as a native screen rather than a RevenueCat-hosted
 * template. Same skeleton as `PaywallScreen` — hero, feature list, pinned footer
 * — but a single offer instead of a plan picker, and a struck-through standard
 * price beside the discounted one.
 */
export default function YearlyOfferPaywallScreen({
  onBack,
  onUnavailable,
}: YearlyOfferPaywallScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sessionUserId = useAppStore(state => state.session?.user.userId ?? null);
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium)
  );
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);

  const [pricing, setPricing] = useState<OfferPricing>(EMPTY_PRICING);
  const [revenueCatOfferings, setRevenueCatOfferings] =
    useState<PurchasesOfferings | null>(null);
  const [paywallConfig, setPaywallConfig] =
    useState<ResolvedPaywallConfig | null>(null);
  const [offerError, setOfferError] = useState<string | null>(
    getRevenueCatConfigurationError()
  );
  const [isLoadingOffer, setIsLoadingOffer] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>("offer");
  const [lastPurchaseStore, setLastPurchaseStore] = useState<string | null>(null);
  const [isPurchaseAccessUpdating, setIsPurchaseAccessUpdating] =
    useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const bulletsAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const iconShake = useRef(new Animated.Value(0)).current;

  const colors = theme.colors;
  const isCompact = width < 360;
  const copy = useMemo(
    () => getPaywallContent(PLACEMENT_KEY, SCREEN_KEY),
    []
  );
  const isBusy = isProcessing || isRestoring;
  const canPurchase = Boolean(pricing.discountPackage) && !isBusy;

  useEffect(() => {
    let isMounted = true;

    const loadOffer = async () => {
      setIsLoadingOffer(true);
      setOfferError(getRevenueCatConfigurationError());

      try {
        const resolvedConfig = sessionUserId
          ? await getPaywallConfig({
              placementKey: PLACEMENT_KEY,
              screenKey: SCREEN_KEY,
              triggerMode: "contextual",
            })
          : null;

        if (!isMounted) {
          return;
        }

        if (resolvedConfig) {
          setPaywallConfig(resolvedConfig);
        }

        // The server-side throttle still governs this placement, exactly as it
        // did on the hosted surface this screen replaced.
        if (resolvedConfig && !resolvedConfig.shouldShow) {
          onBack("continue");
          return;
        }

        const offerings = await getRevenueCatOfferings(sessionUserId);
        const discountPackage = getPackageByProductId(
          offerings,
          REVENUECAT_OFFERINGS.SUMMER_OFFER,
          REVENUECAT_PRODUCTS.YEARLY_DISCOUNT
        );
        const standardPackage = getPackageByProductId(
          offerings,
          REVENUECAT_OFFERINGS.OTHER_SCREENS_STANDARD,
          REVENUECAT_PRODUCTS.YEARLY
        );

        if (!isMounted) {
          return;
        }

        if (!discountPackage) {
          setOfferError(OFFER_UNAVAILABLE_MESSAGE);
          onUnavailable?.();
          return;
        }

        // Only strike a price the user could actually have paid. Different
        // storefronts hand back different currencies, and "$59.99 → ₹2,499"
        // is not a comparison — it's noise. Same rule the hosted paywall used
        // before this screen replaced it.
        const canCompare = Boolean(
          standardPackage?.product.currencyCode &&
            discountPackage.product.currencyCode ===
              standardPackage.product.currencyCode
        );

        setRevenueCatOfferings(offerings);
        setPricing({
          discountPackage,
          discountPrice: resolveProductPriceString(discountPackage.product),
          standardPrice: canCompare
            ? resolveProductPriceString(standardPackage?.product)
            : "",
        });
        setOfferError(null);

        if (resolvedConfig?.template) {
          trackPaywallEvent({
            placementKey: resolvedConfig.placementKey,
            screenKey: resolvedConfig.screenKey || SCREEN_KEY,
            eventType: "paywall_impression",
            templateKey: resolvedConfig.template.key,
            offeringKey: OFFERING_KEY,
            wasInterruptive: resolvedConfig.wasInterruptive,
          }).catch(() => undefined);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.warn("[YearlyOffer] Failed to load the offer", error);
        setOfferError(OFFER_UNAVAILABLE_MESSAGE);
      } finally {
        if (isMounted) {
          setIsLoadingOffer(false);
        }
      }
    };

    loadOffer().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [onBack, onUnavailable, sessionUserId]);

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

  // A short wobble on the offer badge, with a long pause between takes. A
  // continuous shake next to a price reads as an alert; an occasional one reads
  // as a nudge.
  useEffect(() => {
    let isActive = true;
    let animation: Animated.CompositeAnimation | null = null;

    const play = () => {
      if (!isActive) {
        return;
      }

      animation = Animated.loop(
        Animated.sequence([
          Animated.delay(1600),
          ...[1, -1, 0.7, -0.7, 0].map(toValue =>
            Animated.timing(iconShake, {
              toValue,
              duration: 70,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            })
          ),
        ])
      );
      animation.start();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!isActive || enabled) {
          return;
        }
        play();
      })
      .catch(play);

    return () => {
      isActive = false;
      animation?.stop();
      iconShake.stopAnimation();
    };
  }, [iconShake]);

  const trackEvent = (
    eventType:
      | "paywall_dismiss"
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
      screenKey: paywallConfig.screenKey || SCREEN_KEY,
      eventType,
      templateKey: paywallConfig.template.key,
      offeringKey: OFFERING_KEY,
      wasInterruptive: paywallConfig.wasInterruptive,
      metadata,
    }).catch(() => undefined);
  };

  const completePremiumActivation = async (
    customerInfo: CustomerInfo,
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
    setIsPurchaseAccessUpdating(false);
    setScreenState("success");
    return true;
  };

  const finalizePremiumActivation = async (
    customerInfo: CustomerInfo,
    options: { wasRestore?: boolean } = {}
  ) => {
    const activated = await completePremiumActivation(customerInfo, options);

    if (activated !== false || !sessionUserId) {
      return activated;
    }

    const refreshed = await refreshRevenueCatEntitlementState(sessionUserId);

    if (!refreshed.customerInfo) {
      return false;
    }

    return completePremiumActivation(refreshed.customerInfo, options);
  };

  const handleDismiss = () => {
    trackEvent("paywall_dismiss");
    triggerHaptic("back").catch(() => undefined);
    onBack("dismiss");
  };

  const handleUpgrade = async () => {
    if (isBusy) {
      return;
    }
    if (!pricing.discountPackage) {
      Alert.alert("Offer unavailable", offerError || OFFER_UNAVAILABLE_MESSAGE);
      return;
    }

    setIsProcessing(true);
    triggerHaptic("primaryAction").catch(() => undefined);

    try {
      trackEvent("cta_tap");
      const purchaseResult = await purchaseRevenueCatPackage(
        pricing.discountPackage,
        sessionUserId
      );
      const activated = await finalizePremiumActivation(
        purchaseResult.customerInfo
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

      Alert.alert(
        "Premium activation unavailable",
        getPurchaseErrorMessage(error)
      );
      trackEvent("purchase_failure", {
        message: getPurchaseErrorMessage(error),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (isBusy) {
      return;
    }

    setIsRestoring(true);

    try {
      const customerInfo = await restoreRevenueCatPurchases(sessionUserId);

      if (!hasPremiumAccess(customerInfo)) {
        Alert.alert(NO_RESTORED_PURCHASE_TITLE, NO_RESTORED_PURCHASE_MESSAGE);
        return;
      }

      await finalizePremiumActivation(customerInfo, { wasRestore: true });
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
        onPrimaryAction={() => onBack("continue")}
      />
    );
  }

  const showLoading = isLoadingOffer && !pricing.discountPackage;
  const heroStyle = {
    opacity: heroAnim,
    transform: [
      {
        translateY: heroAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };
  const bulletsStyle = {
    opacity: bulletsAnim,
    transform: [
      {
        translateY: bulletsAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };
  const footerStyle = {
    opacity: footerAnim,
    transform: [
      {
        translateY: footerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
    ],
  };
  const iconShakeStyle = {
    transform: [
      {
        rotate: iconShake.interpolate({
          inputRange: [-1, 1],
          outputRange: ["-7deg", "7deg"],
        }),
      },
    ],
  };

  return (
    <SafeAreaView
      edges={["top", "right", "left"]}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
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
          <Animated.View
            style={[
              styles.offerIconWrap,
              { backgroundColor: `${colors.primary}1A` },
              iconShakeStyle,
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              source={OFFER_ICON}
              style={styles.offerIcon}
              testID="yearly-offer-icon"
            />
          </Animated.View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {copy.eyebrow}
          </Text>
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
          {copy.bullets.map(bullet => (
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
          ))}
        </Animated.View>
      </ScrollView>

      <Animated.View
        onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
            shadowColor: PAYWALL_SHADOW_COLOR,
            shadowOpacity: theme.mode === "dark" ? 0.5 : 0.08,
          },
          footerStyle,
        ]}
      >
        {showLoading ? (
          <View style={styles.footerLoading}>
            <JournalLoader color={colors.primary} />
          </View>
        ) : (
          <View
            style={[
              styles.offerCard,
              {
                backgroundColor: `${colors.primary}12`,
                borderColor: colors.primary,
              },
            ]}
          >
            <View style={styles.offerCardHeader}>
              <Text style={[styles.offerName, { color: colors.foreground }]}>
                Yearly
              </Text>
              <View
                style={[styles.offerTag, { backgroundColor: colors.primary }]}
              >
                <Text
                  style={[
                    styles.offerTagText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  50% OFF
                </Text>
              </View>
            </View>
            {/* Both prices come from StoreKit already localized to the user's
                storefront, so they are never composed from a raw number and a
                currency symbol. `PriceText` keeps each on one line. */}
            <View style={styles.priceRow}>
              {pricing.standardPrice ? (
                <PriceText
                  accessibilityLabel={`Usually ${pricing.standardPrice} per year`}
                  minimumFontScale={0.6}
                  style={[
                    styles.standardPrice,
                    { color: colors.mutedForeground },
                  ]}
                  testID="yearly-offer-standard-price"
                  value={pricing.standardPrice}
                />
              ) : null}
              <PriceText
                accessibilityLabel={`Now ${pricing.discountPrice} per year`}
                minimumFontScale={0.6}
                style={[
                  styles.discountPrice,
                  {
                    color: colors.foreground,
                    fontSize: isCompact ? 26 : 30,
                  },
                ]}
                testID="yearly-offer-discount-price"
                value={pricing.discountPrice || "Price unavailable"}
              />
              {pricing.discountPrice ? (
                <Text
                  style={[styles.pricePeriod, { color: colors.mutedForeground }]}
                >
                  /year
                </Text>
              ) : null}
            </View>
            <Text style={[styles.offerSubtitle, { color: colors.mutedForeground }]}>
              Billed once, then renews yearly at the standard price. Cancel
              anytime in Settings.
            </Text>
          </View>
        )}

        {offerError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {offerError}
          </Text>
        ) : null}

        <HapticPressable
          accessibilityLabel="Claim this offer"
          accessibilityRole="button"
          accessibilityState={{ busy: isProcessing, disabled: !canPurchase }}
          disabled={!canPurchase}
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
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
              Claim this offer
            </Text>
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
          <Text style={[styles.footerDot, { color: colors.mutedForeground }]}>
            ·
          </Text>
          <HapticPressable
            accessibilityLabel="Terms of Service"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              openExternalUrl(
                LEGAL_URLS.termsOfService,
                "Terms of Service"
              ).catch(() => undefined)
            }
          >
            <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>
              Terms
            </Text>
          </HapticPressable>
          <Text style={[styles.footerDot, { color: colors.mutedForeground }]}>
            ·
          </Text>
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
    marginBottom: 32,
    marginTop: 6,
  },
  offerIconWrap: {
    alignItems: "center",
    borderRadius: 22,
    height: 68,
    justifyContent: "center",
    marginBottom: 16,
    width: 68,
  },
  offerIcon: {
    height: 40,
    resizeMode: "contain",
    width: 40,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
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
    borderTopWidth: 1,
    bottom: 0,
    elevation: 12,
    left: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    position: "absolute",
    right: 0,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 18,
  },
  footerLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 34,
  },
  offerCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  offerCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  offerName: {
    fontSize: 14,
    fontWeight: "600",
  },
  offerTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offerTagText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  priceRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  standardPrice: {
    fontSize: 16,
    fontWeight: "600",
    // `flexShrink` so a long storefront price gives ground to the offer price
    // rather than pushing it off the card.
    flexShrink: 1,
    textDecorationLine: "line-through",
  },
  discountPrice: {
    flexShrink: 1,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  pricePeriod: {
    fontSize: 13,
    fontWeight: "600",
  },
  offerSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
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
