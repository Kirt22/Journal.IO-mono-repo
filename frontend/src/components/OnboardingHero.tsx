import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import {
  BookOpen,
  Feather,
  LockKeyhole,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";
import { useTheme } from "../theme/provider";
import CelebrationSparkles from "./CelebrationSparkles";
import JournalWordmark from './JournalWordmark';

type OnboardingHeroVariant =
  | "welcome"
  | "support"
  | "tone"
  | "theme"
  | "complete"
  | "privacy"
  | "reflection";

type OnboardingHeroProps = {
  variant: OnboardingHeroVariant;
};

const iconByVariant = {
  welcome: BookOpen,
  support: Sparkles,
  tone: Feather,
  theme: Palette,
  complete: BookOpen,
  privacy: ShieldCheck,
  reflection: LockKeyhole,
} satisfies Record<OnboardingHeroVariant, typeof BookOpen>;

export default function OnboardingHero({ variant }: OnboardingHeroProps) {
  const theme = useTheme();
  const float = useRef(new Animated.Value(0)).current;
  const Icon = iconByVariant[variant];
  const isWelcome = variant === "welcome";
  const isComplete = variant === "complete";

  useEffect(() => {
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -3,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatAnimation.start();

    return () => {
      floatAnimation.stop();
    };
  }, [float]);

  return (
    <View style={[styles.root, isWelcome && styles.welcomeRoot]}>
      {!isWelcome ? <View style={styles.glowLayer} /> : null}
      {isWelcome ? (
        <Animated.View
          style={[styles.wordmarkWrap, { transform: [{ translateY: float }] }]}
        >
          <JournalWordmark accessibilityLabel="Journal.IO" />
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.bookShell,
            isComplete && styles.completeShell,
            {
              backgroundColor: theme.colors.card,
              borderColor: "#E7D6C7",
              transform: [{ translateY: float }],
            },
          ]}
        >
          <>
            <View style={styles.bookSpine} />
            <View style={styles.bookPage} />
            <Icon color={theme.colors.primary} size={30} strokeWidth={1.8} />
          </>
        </Animated.View>
      )}
      {isComplete ? <CelebrationSparkles /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bookPage: {
    backgroundColor: "#FFF8F1",
    borderRadius: 16,
    bottom: 12,
    left: 24,
    opacity: 0.9,
    position: "absolute",
    right: 12,
    top: 12,
  },
  bookShell: {
    alignItems: "center",
    borderRadius: 30,
    borderWidth: 1,
    height: 96,
    justifyContent: "center",
    shadowColor: "#8E4636",
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    width: 96,
  },
  bookSpine: {
    backgroundColor: "#E9A16F",
    borderBottomLeftRadius: 22,
    borderTopLeftRadius: 22,
    bottom: 10,
    left: 10,
    position: "absolute",
    top: 10,
    width: 20,
  },
  completeShell: {
    height: 86,
    width: 86,
  },
  glowLayer: {
    backgroundColor: "#F8D6B6",
    borderRadius: 80,
    height: 112,
    opacity: 0.24,
    position: "absolute",
    width: 112,
  },
  root: {
    alignItems: "center",
    height: 118,
    justifyContent: "center",
    width: "100%",
  },
  welcomeRoot: {
    height: 126,
  },
  wordmarkWrap: {
    maxWidth: 340,
    width: '100%',
  },
});

export type { OnboardingHeroVariant };
