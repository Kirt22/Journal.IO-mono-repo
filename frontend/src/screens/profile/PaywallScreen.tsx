import { useEffect, useRef, useState } from "react";
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
import { Check, Crown, Shield, Sparkles, X, Zap } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/provider";
import mascotImage from "../../assets/png/Masscott.png";

type PaywallScreenProps = {
  onBack: () => void;
};

const plans = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$4.99",
    period: "/month",
    popular: false,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$39.99",
    period: "/year",
    popular: true,
    savings: "Save 33%",
  },
];

const features = [
  { icon: Sparkles, text: "Unlimited AI-powered insights and prompts" },
  { icon: Crown, text: "Advanced mood tracking and analytics" },
  { icon: Zap, text: "Priority customer support" },
  { icon: Shield, text: "Enhanced privacy and security features" },
  { icon: Check, text: "Export all your entries anytime" },
  { icon: Check, text: "Custom tags and unlimited entries" },
  { icon: Check, text: "Ad-free experience forever" },
  { icon: Check, text: "Access to premium prompts library" },
];

function PlanOption({
  name,
  price,
  period,
  popular,
  savings,
  selected,
  onPress,
  delay,
}: {
  name: string;
  price: string;
  period: string;
  popular: boolean;
  savings?: string;
  selected: boolean;
  onPress: () => void;
  delay: number;
}) {
  const theme = useTheme();
  const entryAnim = useRef(new Animated.Value(0)).current;
  const selectedCardStyle = selected
    ? {
        backgroundColor: `${theme.colors.primary}0D`,
        borderColor: theme.colors.primary,
      }
    : {
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      };
  const radioStyle = {
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    backgroundColor: selected ? theme.colors.primary : "transparent",
  };

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, entryAnim]);

  const translateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.planOption,
          selectedCardStyle,
          pressed && styles.pressed,
        ]}
      >
        {popular ? (
          <View style={[styles.planBadge, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.planBadgeText, { color: theme.colors.primaryForeground }]}>
              Most Popular
            </Text>
          </View>
        ) : null}
        {savings ? (
          <View style={[styles.planBadge, { backgroundColor: theme.colors.success }]}>
            <Text style={[styles.planBadgeText, { color: theme.colors.successForeground }]}>
              {savings}
            </Text>
          </View>
        ) : null}

        <View style={styles.planRow}>
          <View style={styles.planCopy}>
            <Text style={[styles.planName, { color: theme.colors.foreground }]}>
              {name}
            </Text>
            <Text style={[styles.planPeriod, { color: theme.colors.mutedForeground }]}>
              <Text style={[styles.planPrice, { color: theme.colors.foreground }]}>
                {price}
              </Text>{" "}
              {period}
            </Text>
          </View>
          <View
            style={[styles.radioOuter, radioStyle]}
          >
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function FeatureRow({
  icon,
  text,
  delay,
}: {
  icon: typeof Sparkles;
  text: string;
  delay: number;
}) {
  const theme = useTheme();
  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 360,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, entryAnim]);

  const Icon = icon;
  const translateX = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: entryAnim,
        transform: [{ translateX }],
      }}
    >
      <View style={styles.featureRow}>
        <View style={[styles.featureIconWrap, { backgroundColor: `${theme.colors.primary}14` }]}>
          <Icon size={16} color={theme.colors.primary} />
        </View>
        <Text style={[styles.featureText, { color: theme.colors.mutedForeground }]}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function PaywallScreen({ onBack }: PaywallScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 360;
  const horizontalPadding = isCompact ? 16 : 24;
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [isProcessing, setIsProcessing] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const trustAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const mascotFloat = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(130, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(trustAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(mascotFloat, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    glowLoop.start();

    return () => {
      floatLoop.stop();
      glowLoop.stop();
    };
  }, [footerAnim, glowPulse, headerAnim, heroAnim, mascotFloat, trustAnim]);

  const handleUpgrade = async () => {
    setIsProcessing(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert("Premium", "Billing is not connected yet in this build.", [
        {
          text: "Continue",
          onPress: onBack,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    Alert.alert("Restore purchases", "Restore purchases is not connected yet.");
  };

  const headerTranslate = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 0],
  });
  const heroTranslate = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const trustTranslate = trustAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const footerTranslate = footerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const mascotTranslate = mascotFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.7],
  });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.container}>
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
          <Text style={[styles.headerLabel, { color: theme.colors.mutedForeground }]}>
            Upgrade to Premium
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: theme.colors.accent },
              pressed && styles.pressed,
            ]}
          >
            <X size={18} color={theme.colors.foreground} />
          </Pressable>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollArea,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + 156,
            },
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
                  styles.mascotGlow,
                  {
                    opacity: glowOpacity,
                    transform: [{ scale: glowScale }],
                    backgroundColor: `${theme.colors.primary}20`,
                  },
                ]}
              />
              <Animated.Image
                source={mascotImage}
                style={[
                  styles.mascot,
                  {
                    transform: [{ translateY: mascotTranslate }],
                  },
                ]}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.heroTitle, { color: theme.colors.foreground }]}>
              Unlock Your Full Potential
            </Text>
            <Text style={[styles.heroText, { color: theme.colors.mutedForeground }]}>
              Get unlimited access to AI insights, advanced analytics, and premium features to
              deepen your journaling practice.
            </Text>
          </Animated.View>

          <View style={styles.planList}>
            {plans.map((plan, index) => (
              <PlanOption
                key={plan.id}
                name={plan.name}
                price={plan.price}
                period={plan.period}
                popular={plan.popular}
                savings={plan.savings}
                selected={selectedPlan === plan.id}
                delay={120 + index * 90}
                onPress={() => setSelectedPlan(plan.id)}
              />
            ))}
          </View>

          <View style={styles.featureSection}>
            <Text style={[styles.featureHeading, { color: theme.colors.foreground }]}>
              What you&apos;ll get:
            </Text>
            <View style={styles.featureList}>
              {features.map((feature, index) => (
                <FeatureRow
                  key={feature.text}
                  icon={feature.icon}
                  text={feature.text}
                  delay={360 + index * 45}
                />
              ))}
            </View>
          </View>

          <Animated.View
            style={[
              styles.trustCard,
              {
                backgroundColor: theme.colors.accent,
                opacity: trustAnim,
                transform: [{ translateY: trustTranslate }],
              },
            ]}
          >
            <Text style={[styles.trustText, { color: theme.colors.mutedForeground }]}>
              Cancel anytime. No commitments. 30-day money-back guarantee.
            </Text>
          </Animated.View>
        </ScrollView>

        <Animated.View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + 14,
              opacity: footerAnim,
              transform: [{ translateY: footerTranslate }],
            },
          ]}
        >
          <PrimaryButton
            label={isProcessing ? "Processing..." : "Start Premium Trial"}
            onPress={handleUpgrade}
            loading={isProcessing}
            tone="accent"
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleRestore}
            disabled={isProcessing}
            style={styles.restoreButton}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
            ) : (
              <Text style={[styles.restoreText, { color: theme.colors.mutedForeground }]}>
                Restore Purchases
              </Text>
            )}
          </Pressable>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    gap: 20,
  },
  hero: {
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
  },
  mascotWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  mascotGlow: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  mascot: {
    width: 124,
    height: 124,
  },
  heroTitle: {
    fontSize: 28,
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
  planList: {
    gap: 12,
  },
  planOption: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    overflow: "hidden",
  },
  planBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 14,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  planRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  planCopy: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: "600",
  },
  planPeriod: {
    marginTop: 4,
    fontSize: 13,
  },
  planPrice: {
    fontSize: 26,
    fontWeight: "700",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  featureSection: {
    gap: 14,
  },
  featureHeading: {
    fontSize: 18,
    fontWeight: "600",
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 1,
  },
  trustCard: {
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  trustText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 14,
  },
  restoreButton: {
    alignItems: "center",
    paddingVertical: 4,
    minHeight: 20,
    justifyContent: "center",
  },
  restoreText: {
    fontSize: 13,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.85,
  },
});
