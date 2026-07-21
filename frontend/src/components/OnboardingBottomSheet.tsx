import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check } from "lucide-react-native";
import { triggerHaptic } from "../services/hapticsService";
import { useTheme } from "../theme/provider";
import ButtonLoadingContent from './ButtonLoadingContent';

type OnboardingBottomSheetProps = {
  visible: boolean;
  title: string;
  body?: string;
  bodyPoints: string[];
  primaryLabel?: string;
  requireConsent: boolean;
  consentAccepted: boolean;
  onToggleConsent: () => void;
  onPrivacyPress: () => void;
  onTermsPress: () => void;
  onContinue: () => void;
  onDismiss?: () => void;
  isSubmitting?: boolean;
};

const HALF_SNAP_RATIO = 0.48;

export default function OnboardingBottomSheet({
  visible,
  title,
  body,
  bodyPoints,
  primaryLabel = "Continue",
  requireConsent,
  consentAccepted,
  onToggleConsent,
  onPrivacyPress,
  onTermsPress,
  onContinue,
  onDismiss,
  isSubmitting = false,
}: OnboardingBottomSheetProps) {
  const theme = useTheme();
  const slide = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const checkboxScale = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonHighlight = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(visible);
  const isClosingRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const sheetHeightRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const snapPositionRef = useRef<"expanded" | "half">("expanded");

  const getHalfSnapOffset = () =>
    Math.max(160, sheetHeightRef.current * HALF_SNAP_RATIO);

  const animateSheet = useCallback((toVisible: boolean, onFinished?: () => void) => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: toVisible ? 1 : 0,
        duration: toVisible ? 320 : 230,
        easing: toVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: toVisible ? 1 : 0,
        duration: toVisible ? 260 : 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onFinished?.();
      }
    });
  }, [scrimOpacity, slide]);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setIsMounted(true);
      isClosingRef.current = false;
      slide.setValue(0);
      dragY.setValue(0);
      dragStartOffsetRef.current = 0;
      snapPositionRef.current = "expanded";
      scrimOpacity.setValue(0);
      requestAnimationFrame(() => animateSheet(true));
    }

    if (!visible && wasVisibleRef.current && isMounted && !isClosingRef.current) {
      isClosingRef.current = true;
      animateSheet(false, () => {
        setIsMounted(false);
        isClosingRef.current = false;
      });
    }

    wasVisibleRef.current = visible;
  }, [animateSheet, dragY, isMounted, scrimOpacity, slide, visible]);

  const canContinue = !requireConsent || consentAccepted;
  useEffect(() => {
    if (!consentAccepted) {
      buttonHighlight.setValue(0);
      return;
    }

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 1.025,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          damping: 15,
          stiffness: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(buttonHighlight, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonHighlight, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [buttonHighlight, buttonScale, consentAccepted]);

  const closeWithAnimation = (onClosed?: () => void) => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    animateSheet(false, () => {
      setIsMounted(false);
      isClosingRef.current = false;
      dragY.setValue(0);
      dragStartOffsetRef.current = 0;
      snapPositionRef.current = "expanded";
      onClosed?.();
    });
  };
  const snapTo = (position: "expanded" | "half") => {
    const toValue = position === "half" ? getHalfSnapOffset() : 0;

    snapPositionRef.current = position;
    dragStartOffsetRef.current = toValue;
    Animated.spring(dragY, {
      toValue,
      damping: 22,
      stiffness: 185,
      mass: 0.92,
      useNativeDriver: true,
    }).start();
  };
  const handleDismiss = () => {
    triggerHaptic("secondaryAction").catch(() => undefined);
    closeWithAnimation(onDismiss);
  };
  const handlePrivacyPress = () => {
    if (isSubmitting) {
      return;
    }

    triggerHaptic("legal").catch(() => undefined);
    onPrivacyPress();
  };
  const handleTermsPress = () => {
    if (isSubmitting) {
      return;
    }

    triggerHaptic("legal").catch(() => undefined);
    onTermsPress();
  };
  const handleToggleConsent = () => {
    if (isSubmitting) {
      return;
    }

    triggerHaptic("optionSelected").catch(() => undefined);
    checkboxScale.setValue(1);
    Animated.sequence([
      Animated.timing(checkboxScale, {
        toValue: 0.9,
        duration: 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(checkboxScale, {
        toValue: 1,
        damping: 8,
        stiffness: 260,
        useNativeDriver: true,
      }),
    ]).start();
    onToggleConsent();
  };
  const handleContinue = () => {
    if (!canContinue || isSubmitting) {
      return;
    }

    triggerHaptic("primaryAction").catch(() => undefined);
    onContinue();
  };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isVertical =
          Math.abs(gestureState.dy) > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;

        if (!isVertical) {
          return false;
        }

        return gestureState.dy > 0 || snapPositionRef.current === "half";
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVertical =
          Math.abs(gestureState.dy) > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;

        if (!isVertical) {
          return false;
        }

        return gestureState.dy > 0 || snapPositionRef.current === "half";
      },
      onPanResponderGrant: () => {
        dragY.stopAnimation(value => {
          dragStartOffsetRef.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(Math.max(0, dragStartOffsetRef.current + gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        const nextOffset = Math.max(0, dragStartOffsetRef.current + gestureState.dy);
        const halfOffset = getHalfSnapOffset();
        const isFromHalf = snapPositionRef.current === "half";

        if (nextOffset > halfOffset * 1.72 || gestureState.vy > 1.15) {
          handleDismiss();
          return;
        }

        if (isFromHalf && (gestureState.dy < -42 || nextOffset < halfOffset * 0.56)) {
          snapTo("expanded");
          return;
        }

        if (nextOffset > halfOffset * 0.42 || gestureState.vy > 0.34) {
          snapTo("half");
          return;
        }

        snapTo("expanded");
      },
      onPanResponderTerminate: () => {
        snapTo(snapPositionRef.current);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;
  const sheetTranslateY = Animated.add(
    slide.interpolate({
      inputRange: [0, 1],
      outputRange: [360, 0],
    }),
    dragY
  );
  const interactiveScrimOpacity = Animated.multiply(
    scrimOpacity,
    dragY.interpolate({
      inputRange: [0, 260],
      outputRange: [1, 0.46],
      extrapolate: "clamp",
    })
  );

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onDismiss ? handleDismiss : undefined}
      transparent
      visible={isMounted}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          style={[
            styles.scrim,
            {
              opacity: interactiveScrimOpacity,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Dismiss disclaimer"
            style={StyleSheet.absoluteFill}
            onPress={onDismiss ? handleDismiss : undefined}
          />
        </Animated.View>
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={event => {
            sheetHeightRef.current = event.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.grabber} />
          <Text style={[styles.title, { color: theme.colors.foreground }]}>
            {title}
          </Text>
          {body ? (
            <Text style={[styles.body, { color: theme.colors.mutedForeground }]}>
              {body}
            </Text>
          ) : null}
          <View style={styles.points}>
            {bodyPoints.map(point => (
              <View key={point} style={styles.pointRow}>
                <View style={styles.pointDot} />
                <Text
                  style={[
                    styles.pointText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {point}
                </Text>
              </View>
            ))}
          </View>
          {requireConsent ? (
            <View style={styles.consentRow}>
              <Pressable
                accessibilityLabel="Agree to Privacy Policy and Terms"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
                disabled={isSubmitting}
                hitSlop={8}
                onPress={handleToggleConsent}
              >
                <Animated.View
                  style={[
                    styles.checkbox,
                    {
                      transform: [{ scale: checkboxScale }],
                    },
                    {
                      backgroundColor: consentAccepted
                        ? theme.colors.primary
                        : "transparent",
                      borderColor: consentAccepted
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                >
                  {consentAccepted ? (
                    <Check color={theme.colors.primaryForeground} size={12} />
                  ) : null}
                </Animated.View>
              </Pressable>
              <Text
                style={[
                  styles.consentText,
                  { color: theme.colors.foreground },
                ]}
              >
                I agree to the{" "}
                <Text
                  accessibilityRole="link"
                  onPress={handlePrivacyPress}
                  style={[styles.legalLink, { color: theme.colors.primary }]}
                >
                  Privacy Policy
                </Text>{" "}
                and{" "}
                <Text
                  accessibilityRole="link"
                  onPress={handleTermsPress}
                  style={[styles.legalLink, { color: theme.colors.primary }]}
                >
                  Terms
                </Text>
                .
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.consentText,
                styles.passiveAgreementText,
                { color: theme.colors.foreground },
              ]}
            >
              I agree to the{" "}
              <Text
                accessibilityRole="link"
                onPress={handlePrivacyPress}
                style={[styles.legalLink, { color: theme.colors.primary }]}
              >
                Privacy Policy
              </Text>{" "}
              and{" "}
              <Text
                accessibilityRole="link"
                onPress={handleTermsPress}
                style={[styles.legalLink, { color: theme.colors.primary }]}
              >
                Terms
              </Text>
              .
            </Text>
          )}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSubmitting ? "Starting your first reflection" : primaryLabel}
              accessibilityState={{ busy: isSubmitting, disabled: !canContinue || isSubmitting }}
              disabled={!canContinue || isSubmitting}
              onPress={handleContinue}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: canContinue
                    ? theme.colors.primary
                    : theme.colors.muted,
                },
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.primaryButtonHighlight,
                  {
                    opacity: buttonHighlight.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.34, 0],
                    }),
                    transform: [
                      {
                        translateX: buttonHighlight.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-170, 170],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <ButtonLoadingContent
                loaderColor={theme.colors.primaryForeground}
                loading={isSubmitting}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color: canContinue
                        ? theme.colors.primaryForeground
                        : theme.colors.mutedForeground,
                    },
                  ]}
                >
                  {primaryLabel}
                </Text>
              </ButtonLoadingContent>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    alignItems: "center",
    borderRadius: 7,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  consentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: "#E3D6CC",
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 42,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  passiveAgreementText: {
    marginTop: 14,
  },
  pointDot: {
    backgroundColor: "#E9A16F",
    borderRadius: 999,
    height: 5,
    marginTop: 7,
    width: 5,
  },
  pointRow: {
    flexDirection: "row",
    gap: 9,
  },
  pointText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  points: {
    gap: 8,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 17,
    justifyContent: "center",
    marginTop: 16,
    overflow: "hidden",
    paddingVertical: 14,
  },
  primaryButtonHighlight: {
    backgroundColor: "rgba(255, 255, 255, 0.34)",
    bottom: -12,
    position: "absolute",
    top: -12,
    width: 68,
  },
  primaryButtonLoader: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45, 42, 38, 0.32)",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#2D2A26",
    shadowOffset: {
      width: 0,
      height: -12,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  title: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.3,
    textAlign: "center",
  },
});
