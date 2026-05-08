import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gift, Sparkles } from "lucide-react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { hasRevenueCatHostedPaywall } from "../../services/revenueCatService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";

const AnimatedWheel = Animated.createAnimatedComponent(View);

const SEGMENTS = [
  { label: "20%", color: "#F6C9B2", textColor: "#5B382F" },
  { label: "10%", color: "#F8DFC0", textColor: "#5A4434" },
  { label: "30%", color: "#E7B86D", textColor: "#4F3726" },
  { label: "40%", color: "#F2A489", textColor: "#552E27" },
  { label: "GIFT", color: "#E87461", textColor: "#FFFFFF" },
] as const;

const SEGMENT_ANGLE = 360 / SEGMENTS.length;
const WHEEL_RADIUS = 132;
const BASE_ROTATION_DEG = 360 * 4 + 72;
const AUTO_CONTINUE_DELAY_MS = 760;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) => ({
  x: centerX + radius * Math.cos(toRadians(angleInDegrees)),
  y: centerY + radius * Math.sin(toRadians(angleInDegrees)),
});

const describeArc = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

export default function SpinWheelScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const continueFromSpinWheel = useAppStore(state => state.continueFromSpinWheel);
  const fallbackFromSpinWheel = useAppStore(state => state.fallbackFromSpinWheel);
  const [isComplete, setIsComplete] = useState(false);
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const badgeEntrance = useRef(new Animated.Value(0)).current;
  const wheelSize = Math.min(width - (width < 360 ? 60 : 80), 320);
  const scale = wheelSize / (WHEEL_RADIUS * 2);
  const rootPaddingHorizontal = width < 360 ? 18 : 24;

  useEffect(() => {
    glowPulse.setValue(0);

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    glowLoop.start();

    return () => {
      glowLoop.stop();
    };
  }, [glowPulse]);

  useEffect(() => {
    let isMounted = true;
    let continueTimer: ReturnType<typeof setTimeout> | null = null;

    const spin = Animated.timing(wheelRotation, {
      toValue: BASE_ROTATION_DEG,
      duration: 3200,
      easing: Easing.bezier(0.12, 0.92, 0.18, 1),
      useNativeDriver: true,
    });

    spin.start(({ finished }) => {
      if (!finished || !isMounted) {
        return;
      }

      setIsComplete(true);
      Animated.timing(badgeEntrance, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }).start();

      continueTimer = setTimeout(() => {
        if (!isMounted) {
          return;
        }

        if (hasRevenueCatHostedPaywall("exit")) {
          continueFromSpinWheel();
          return;
        }

        fallbackFromSpinWheel();
      }, AUTO_CONTINUE_DELAY_MS);
    });

    return () => {
      isMounted = false;
      if (continueTimer) {
        clearTimeout(continueTimer);
      }
      spin.stop();
    };
  }, [
    badgeEntrance,
    continueFromSpinWheel,
    fallbackFromSpinWheel,
    wheelRotation,
  ]);

  const wheelTransform = useMemo(
    () => ({
      transform: [
        {
          rotate: wheelRotation.interpolate({
            inputRange: [0, BASE_ROTATION_DEG],
            outputRange: ["0deg", `${BASE_ROTATION_DEG}deg`],
          }),
        },
      ],
    }),
    [wheelRotation]
  );

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 26,
            paddingHorizontal: rootPaddingHorizontal,
          },
        ]}
      >
        <Text style={[styles.kicker, { color: theme.colors.primary }]}>
          Final surprise
        </Text>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          Your gift is already on the wheel
        </Text>
        <Text style={[styles.body, { color: theme.colors.mutedForeground }]}>
          We are revealing the follow-up offer now.
        </Text>

        <View style={[styles.wheelShell, { width: wheelSize + 28, height: wheelSize + 60 }]}>
          <Animated.View
            style={[
              styles.wheelGlow,
              {
                width: wheelSize + 12,
                height: wheelSize + 12,
                borderRadius: (wheelSize + 12) / 2,
                backgroundColor: `${theme.colors.primary}16`,
                transform: [{ scale: glowScale }],
              },
            ]}
          />

          <View
            style={[
              styles.needleWrap,
              styles.needleWrapOffset,
            ]}
          >
            <View
              style={[
                styles.needle,
                {
                  borderTopColor: theme.colors.foreground,
                },
              ]}
            />
          </View>

          <AnimatedWheel style={wheelTransform}>
            <Svg
              width={wheelSize}
              height={wheelSize}
              viewBox={`0 0 ${WHEEL_RADIUS * 2} ${WHEEL_RADIUS * 2}`}
            >
              {SEGMENTS.map((segment, index) => {
                const startAngle = -126 + index * SEGMENT_ANGLE;
                const endAngle = startAngle + SEGMENT_ANGLE;
                const textAngle = startAngle + SEGMENT_ANGLE / 2;
                const textPosition = polarToCartesian(
                  WHEEL_RADIUS,
                  WHEEL_RADIUS,
                  WHEEL_RADIUS * 0.68,
                  textAngle
                );

                return (
                  <G key={segment.label}>
                    <Path
                      d={describeArc(
                        WHEEL_RADIUS,
                        WHEEL_RADIUS,
                        WHEEL_RADIUS,
                        startAngle,
                        endAngle
                      )}
                      fill={segment.color}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    <SvgText
                      x={textPosition.x}
                      y={textPosition.y}
                      fill={segment.textColor}
                      fontSize={segment.label === "GIFT" ? 15 : 14}
                      fontWeight="700"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      transform={`rotate(${textAngle + 90} ${textPosition.x} ${textPosition.y})`}
                    >
                      {segment.label}
                    </SvgText>
                  </G>
                );
              })}
              <Circle
                cx={WHEEL_RADIUS}
                cy={WHEEL_RADIUS}
                r={30}
                fill={theme.colors.card}
                stroke={theme.colors.border}
                strokeWidth={2}
              />
            </Svg>
          </AnimatedWheel>

          <View
            style={[
              styles.centerBadge,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                transform: [{ scale }],
              },
            ]}
          >
            <Gift size={24} color={theme.colors.primary} strokeWidth={2} />
          </View>
        </View>

        <Animated.View
          style={[
            styles.resultBadge,
            {
              backgroundColor: theme.colors.accent,
              borderColor: theme.colors.border,
              opacity: badgeEntrance,
              transform: [
                {
                  scale: badgeEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Sparkles size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={[styles.resultText, { color: theme.colors.foreground }]}>
            {isComplete ? "Gift unlocked" : "Spinning to your gift"}
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 320,
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  wheelShell: {
    marginTop: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelGlow: {
    position: "absolute",
  },
  needleWrap: {
    position: "absolute",
    zIndex: 4,
  },
  needleWrapOffset: {
    top: -4,
  },
  needle: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderTopWidth: 30,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  centerBadge: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBadge: {
    marginTop: 20,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
});
