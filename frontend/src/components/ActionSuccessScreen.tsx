import { useEffect, useMemo, useRef } from "react";
import {
  Text,
  View,
} from "../infrastructure/reactNative";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import { ArrowRight, Check, Sparkles } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PrimaryButton from "./PrimaryButton";
import { useTheme } from "../theme/provider";

type ActionSuccessVariant = "payment" | "otp" | "generic";

type ActionSuccessScreenProps = {
  variant?: ActionSuccessVariant;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  onPrimaryAction: () => void | Promise<void>;
  autoAdvanceMs?: number | null;
};

const DEFAULT_COPY: Record<
  ActionSuccessVariant,
  { title: string; subtitle: string; buttonLabel: string }
> = {
  payment: {
    title: "You're Premium",
    subtitle:
      "Welcome to the inner circle. Your journey to a calmer, more mindful life starts now.",
    buttonLabel: "Start Journaling",
  },
  otp: {
    title: "Email Verified",
    subtitle:
      "Your account is now secure and ready. Let's get your profile set up.",
    buttonLabel: "Continue Setup",
  },
  generic: {
    title: "Success!",
    subtitle: "Everything looks good. You're all set to continue.",
    buttonLabel: "Continue",
  },
};

const ICON_ENTRANCE_DURATION_MS = 760;
const TEXT_ENTRANCE_DURATION_MS = 680;
const CTA_ENTRANCE_DURATION_MS = 620;
const ENTRANCE_STAGGER_MS = 260;

export default function ActionSuccessScreen({
  variant = "generic",
  title,
  subtitle,
  buttonLabel,
  onPrimaryAction,
  autoAdvanceMs = null,
}: ActionSuccessScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const horizontalPadding = isCompact ? 20 : width >= 430 ? 30 : 24;
  const maxWidth = width >= 430 ? 430 : 400;
  const copy = DEFAULT_COPY[variant];
  const contentPaddingStyle = useMemo(
    () => ({
      paddingHorizontal: horizontalPadding,
      paddingTop: insets.top + (isCompact ? 12 : 18),
      paddingBottom: insets.bottom + (isCompact ? 18 : 24),
    }),
    [horizontalPadding, insets.bottom, insets.top, isCompact]
  );
  const icon = useMemo(() => {
    if (variant === "otp") {
      return <Check size={44} color={theme.colors.primary} strokeWidth={1.8} />;
    }

    return <Sparkles size={44} color={theme.colors.primary} strokeWidth={1.8} />;
  }, [theme.colors.primary, variant]);

  const iconEntrance = useRef(new Animated.Value(0)).current;
  const textEntrance = useRef(new Animated.Value(0)).current;
  const ctaEntrance = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const outerRingPulse = useRef(new Animated.Value(0)).current;
  const sparkleFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    iconEntrance.setValue(0);
    textEntrance.setValue(0);
    ctaEntrance.setValue(0);

    const entrance = Animated.stagger(ENTRANCE_STAGGER_MS, [
      Animated.timing(iconEntrance, {
        toValue: 1,
        duration: ICON_ENTRANCE_DURATION_MS,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(textEntrance, {
        toValue: 1,
        duration: TEXT_ENTRANCE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ctaEntrance, {
        toValue: 1,
        duration: CTA_ENTRANCE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const outerRingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(outerRingPulse, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(outerRingPulse, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleFloat, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleFloat, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    ringLoop.start();
    outerRingLoop.start();
    sparkleLoop.start();

    return () => {
      entrance.stop();
      ringLoop.stop();
      outerRingLoop.stop();
      sparkleLoop.stop();
    };
  }, [
    ctaEntrance,
    iconEntrance,
    outerRingPulse,
    ringPulse,
    sparkleFloat,
    textEntrance,
  ]);

  useEffect(() => {
    if (!autoAdvanceMs) {
      return;
    }

    const timer = setTimeout(() => {
      onPrimaryAction();
    }, autoAdvanceMs);

    return () => clearTimeout(timer);
  }, [autoAdvanceMs, onPrimaryAction]);

  const ringScale = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const ringOpacity = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.08],
  });
  const outerRingScale = outerRingPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.08, 1.34],
  });
  const outerRingOpacity = outerRingPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.04],
  });
  const iconTranslate = iconEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const textTranslate = textEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const ctaTranslate = ctaEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  const sparkleTranslateY = sparkleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });
  const sparkleTranslateX = sparkleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 4],
  });

  return (
    <SafeAreaView
      edges={[]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.atmosphereLayer}>
          <View
            style={[
              styles.backgroundTint,
              { backgroundColor: `${theme.colors.primary}08` },
            ]}
          />
          <View
            style={[
              styles.backgroundOrbTop,
              { backgroundColor: `${theme.colors.primary}12` },
            ]}
          />
          <View
            style={[
              styles.backgroundOrbBottom,
              { backgroundColor: `${theme.colors.accent}A6` },
            ]}
          />
        </View>

        <View style={[styles.content, contentPaddingStyle]}>
          <View style={[styles.centerContent, { maxWidth }]}>
            <Animated.View
              style={[
                styles.iconArea,
                {
                  opacity: iconEntrance,
                  transform: [{ translateY: iconTranslate }, { scale: iconEntrance }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.iconRing,
                  {
                    borderColor: `${theme.colors.primary}30`,
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.iconRing,
                  styles.outerRing,
                  {
                    borderColor: `${theme.colors.primary}1A`,
                    opacity: outerRingOpacity,
                    transform: [{ scale: outerRingScale }],
                  },
                ]}
              />
              <View
                style={[
                  styles.iconCard,
                  {
                    backgroundColor: `${theme.colors.card}F2`,
                    borderColor: `${theme.colors.primary}14`,
                    shadowColor: theme.colors.primary,
                  },
                ]}
              >
                {icon}
              </View>
              <Animated.View
                style={[
                  styles.sparkleWrap,
                  {
                    transform: [
                      { translateX: sparkleTranslateX },
                      { translateY: sparkleTranslateY },
                    ],
                  },
                ]}
              >
                <Sparkles size={20} color={`${theme.colors.primary}99`} strokeWidth={1.8} />
              </Animated.View>
            </Animated.View>

            <Animated.View
              style={[
                styles.copyWrap,
                {
                  opacity: textEntrance,
                  transform: [{ translateY: textTranslate }],
                },
              ]}
            >
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {title || copy.title}
              </Text>
              <Text
                style={[styles.subtitle, { color: theme.colors.mutedForeground }]}
              >
                {subtitle || copy.subtitle}
              </Text>
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.footer,
              {
                maxWidth,
                opacity: ctaEntrance,
                transform: [{ translateY: ctaTranslate }],
              },
            ]}
          >
            <PrimaryButton
              label={buttonLabel || copy.buttonLabel}
              onPress={onPrimaryAction}
              tone="accent"
              icon={<ArrowRight size={16} color={theme.colors.primaryForeground} />}
            />
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
    position: "relative",
    overflow: "hidden",
  },
  atmosphereLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundTint: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -180,
    right: -150,
    width: 420,
    height: 420,
    borderRadius: 210,
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -220,
    left: -170,
    width: 440,
    height: 440,
    borderRadius: 220,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
  },
  centerContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  iconArea: {
    width: 144,
    height: 144,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 56,
  },
  iconRing: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 44,
    borderWidth: 2,
  },
  outerRing: {
    borderWidth: 1,
  },
  iconCard: {
    width: 112,
    height: 112,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  sparkleWrap: {
    position: "absolute",
    top: 8,
    right: 6,
  },
  copyWrap: {
    width: "100%",
    alignItems: "center",
    gap: 18,
  },
  title: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -1.1,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 29,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 340,
  },
  footer: {
    width: "100%",
    alignSelf: "center",
  },
});
