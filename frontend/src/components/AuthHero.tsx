import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ReactNode } from "react";
import { useTheme } from "../theme/provider";

const mascotImage = require("../assets/png/Masscott.png");

type AuthHeroProps = {
  title: string;
  subtitle: string;
  tone?: "default" | "success";
  imageSize?: number;
  titleSize?: number;
  subtitleMaxWidth?: number;
  children?: ReactNode;
  badge?: ReactNode;
};

export default function AuthHero({
  title,
  subtitle,
  tone = "default",
  imageSize = 100,
  titleSize = 28,
  subtitleMaxWidth = 340,
  children,
  badge,
}: AuthHeroProps) {
  const theme = useTheme();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.mascotShell,
          {
            backgroundColor: theme.colors.accent,
            transform: [{ translateY }],
          },
          tone === "success" ? { borderColor: theme.colors.success } : null,
        ]}
      >
        <View
          style={[
            styles.glow,
            {
              backgroundColor:
                tone === "success" ? theme.colors.success : theme.colors.primary,
            },
          ]}
        />
        <Image
          source={mascotImage}
          style={{ width: imageSize, height: imageSize }}
          resizeMode="contain"
        />

        {badge ? <View style={styles.badgeWrap}>{badge}</View> : null}
      </Animated.View>

      <Text style={[styles.title, { color: theme.colors.foreground, fontSize: titleSize }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: theme.colors.mutedForeground, maxWidth: subtitleMaxWidth },
        ]}
      >
        {subtitle}
      </Text>

      {children ? <View style={styles.childrenWrap}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  mascotShell: {
    width: 128,
    height: 128,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    opacity: 0.08,
  },
  badgeWrap: {
    position: "absolute",
    right: 10,
    top: 10,
  },
  title: {
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  childrenWrap: {
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
});
