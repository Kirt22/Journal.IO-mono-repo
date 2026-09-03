import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ViewShotRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import HapticPressable from '../../components/HapticPressable';
import SharePlaneIcon from '../../components/icons/SharePlaneIcon';
import MindMapShareCard, {
  type MindMapShareRegion,
} from '../../components/MindMapShareCard';
import { withAlpha } from '../../features/brainMap3D/brainMapTheme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { Text } from '../../infrastructure/reactNative';
import type {
  BrainReflectionCenterId,
  GuidedReflectionSessionAnalysisResponse,
} from '../../services/guidedReflectionService';
import { triggerHaptic } from '../../services/hapticsService';
import { captureMindMapCard } from '../../services/mindMapCardCapture';
import { shareMindMapImage } from '../../services/mindMapShareService';
import { useTheme } from '../../theme/provider';

type Props = {
  onMaybeLater: () => void;
  onShared?: () => void;
  selectedRegionId: BrainReflectionCenterId;
  sessionAnalysis: GuidedReflectionSessionAnalysisResponse;
};

// The icon flies in at hero size, then shrinks into the header slot it keeps for
// the rest of the screen.
const ICON_HERO_SIZE = 150;
const ICON_HEADER_SIZE = 36;
const ICON_SHRINK = ICON_HEADER_SIZE / ICON_HERO_SIZE;

export default function OnboardingMindMapShareScreen({
  onMaybeLater,
  onShared,
  selectedRegionId,
  sessionAnalysis,
}: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { height, width } = useWindowDimensions();
  const captureRef = useRef<ViewShotRef>(null);
  const iconFlyIn = useRef(new Animated.Value(0)).current;
  const iconSettle = useRef(new Animated.Value(0)).current;
  const titleReveal = useRef(new Animated.Value(0)).current;
  const cardReveal = useRef(new Animated.Value(0)).current;
  const cardWobble = useRef(new Animated.Value(0)).current;
  const shareReveal = useRef(new Animated.Value(0)).current;
  const laterReveal = useRef(new Animated.Value(0)).current;
  const [actionsInteractive, setActionsInteractive] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cardAttempt, setCardAttempt] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRegion =
    sessionAnalysis.brainSessionMap.centers.find(
      center => center.id === selectedRegionId,
    ) ?? sessionAnalysis.brainSessionMap.dominantCenter;
  const shareRegion = useMemo<MindMapShareRegion>(
    () => ({
      brainRegion: selectedRegion.brainRegion,
      label: selectedRegion.productName,
      regionId: selectedRegion.id,
      scorePercent: Math.round(selectedRegion.score * 100),
      shortInsight: selectedRegion.shortInsight,
    }),
    [selectedRegion],
  );
  const cardWidth = Math.max(
    248,
    Math.min(width - 40, 340, Math.max(248, (height - 340) * 0.8)),
  );
  // The hero lands centred, then rides up into the header. Measured from the
  // icon's resting slot so the travel stays right on every screen height.
  const iconRise = Math.max(120, height * 0.26);

  useEffect(() => {
    iconFlyIn.stopAnimation();
    iconSettle.stopAnimation();
    titleReveal.stopAnimation();
    cardReveal.stopAnimation();
    cardWobble.stopAnimation();
    shareReveal.stopAnimation();
    laterReveal.stopAnimation();

    if (reduceMotion) {
      iconFlyIn.setValue(1);
      iconSettle.setValue(1);
      titleReveal.setValue(1);
      cardReveal.setValue(1);
      cardWobble.setValue(0);
      shareReveal.setValue(1);
      laterReveal.setValue(1);
      setActionsInteractive(true);
      return undefined;
    }

    iconFlyIn.setValue(0);
    iconSettle.setValue(0);
    titleReveal.setValue(0);
    cardReveal.setValue(0);
    cardWobble.setValue(0);
    shareReveal.setValue(0);
    laterReveal.setValue(0);
    setActionsInteractive(false);

    const entrance = Animated.sequence([
      Animated.timing(iconFlyIn, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(iconSettle, {
        delay: 120,
        duration: 420,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(titleReveal, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(cardReveal, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(cardWobble, {
          duration: 95,
          easing: Easing.inOut(Easing.quad),
          toValue: -1,
          useNativeDriver: true,
        }),
        Animated.timing(cardWobble, {
          duration: 130,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(cardWobble, {
          duration: 105,
          easing: Easing.inOut(Easing.quad),
          toValue: -0.5,
          useNativeDriver: true,
        }),
        Animated.timing(cardWobble, {
          duration: 90,
          easing: Easing.out(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(shareReveal, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(laterReveal, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    entrance.start(({ finished }) => {
      if (finished) {
        setActionsInteractive(true);
      }
    });
    return () => entrance.stop();
  }, [
    cardReveal,
    cardWobble,
    iconFlyIn,
    iconSettle,
    laterReveal,
    reduceMotion,
    shareReveal,
    titleReveal,
  ]);

  const handleShare = async () => {
    if (!actionsInteractive) {
      return;
    }

    if (errorMessage) {
      setErrorMessage(null);
      setCardReady(false);
      setCardAttempt(value => value + 1);
      return;
    }

    if (!cardReady || isSharing || !captureRef.current) {
      return;
    }

    setIsSharing(true);
    setErrorMessage(null);
    triggerHaptic('primaryAction').catch(() => undefined);

    let uri: string;
    try {
      uri = await captureMindMapCard(captureRef.current);
    } catch (error) {
      if (__DEV__) {
        console.warn('[MindMapShare] capture failed', error);
      }
      setIsSharing(false);
      // Surfaced verbatim in dev: two very different faults used to read the
      // same, which made this impossible to diagnose from a screenshot.
      setErrorMessage(
        __DEV__
          ? `Card capture failed: ${String(
              (error as Error)?.message ?? error,
            )}`
          : "We couldn't prepare your card right now. Please try again.",
      );
      return;
    }

    try {
      const result = await shareMindMapImage(uri);
      if (result === 'shared') {
        onShared?.();
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[MindMapShare] share failed', error);
      }
      setErrorMessage(
        __DEV__
          ? `Share sheet failed: ${String((error as Error)?.message ?? error)}`
          : "We couldn't open sharing right now. Please try again.",
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleMaybeLater = () => {
    if (!actionsInteractive) {
      return;
    }
    triggerHaptic('secondaryAction').catch(() => undefined);
    onMaybeLater();
  };

  const shareDisabled = !errorMessage && (!cardReady || isSharing);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.iconSlot}>
            <Animated.View
              pointerEvents="none"
              style={{
                opacity: iconFlyIn,
                transform: [
                  {
                    translateX: iconFlyIn.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-(width + ICON_HERO_SIZE), 0],
                    }),
                  },
                  {
                    translateY: iconSettle.interpolate({
                      inputRange: [0, 1],
                      outputRange: [iconRise, 0],
                    }),
                  },
                  {
                    scale: iconSettle.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, ICON_SHRINK],
                    }),
                  },
                ],
              }}
            >
              <SharePlaneIcon
                foldColor={theme.colors.primary}
                size={ICON_HERO_SIZE}
                testID="onboarding-mind-map-share-icon"
                wingColor={withAlpha(theme.colors.primary, 0.65)}
              />
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.heading,
              {
                opacity: titleReveal,
                transform: [
                  {
                    translateY: titleReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.colors.foreground }]}>
              Don&apos;t let your first Mind Map stay hidden.
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: cardReveal,
            transform: [
              {
                translateY: cardReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
              {
                translateX: cardWobble.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-4, 0, 4],
                }),
              },
              {
                rotate: cardWobble.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: ['-2deg', '0deg', '2deg'],
                }),
              },
            ],
          }}
        >
          <MindMapShareCard
            key={`${shareRegion.regionId}-${cardAttempt}`}
            onReadyChange={setCardReady}
            onRenderError={() =>
              setErrorMessage(
                "We couldn't prepare your card right now. Please try again.",
              )
            }
            ref={captureRef}
            region={shareRegion}
            style={{ width: cardWidth }}
            testID="onboarding-mind-map-share-card"
          />
        </Animated.View>

        {/* Held inert until the entrance finishes, so the tap that brought the
            user here cannot fall through onto "Maybe later" and skip the step. */}
        <View
          pointerEvents={actionsInteractive ? 'auto' : 'none'}
          style={styles.actions}
          testID="onboarding-mind-map-share-actions"
        >
          {errorMessage ? (
            <Text
              accessibilityRole="alert"
              style={[styles.errorText, { color: theme.colors.destructive }]}
            >
              {errorMessage}
            </Text>
          ) : null}
          <Animated.View
            style={[
              styles.actionRow,
              {
                opacity: shareReveal,
                transform: [
                  {
                    translateY: shareReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <HapticPressable
              accessibilityLabel={
                errorMessage ? 'Try preparing share card again' : 'Share now'
              }
              accessibilityRole="button"
              disabled={shareDisabled}
              hapticEvent={false}
              onPress={handleShare}
              style={({ pressed }) => [
                styles.shareButton,
                { backgroundColor: theme.colors.primary },
                shareDisabled && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <ButtonLoadingContent
                loaderColor={theme.colors.primaryForeground}
                loading={isSharing}
              >
                <Text
                  style={[
                    styles.shareButtonText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  {errorMessage ? 'Try again' : 'Share now'}
                </Text>
              </ButtonLoadingContent>
            </HapticPressable>
          </Animated.View>

          <Animated.View
            style={[
              styles.actionRow,
              {
                opacity: laterReveal,
                transform: [
                  {
                    translateY: laterReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <HapticPressable
              accessibilityLabel="Maybe later"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleMaybeLater}
              style={({ pressed }) => [
                styles.laterButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.laterText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Maybe later
              </Text>
            </HapticPressable>
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
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    width: '100%',
  },
  // Reserves the header-sized slot from the first frame so the title and card
  // do not jump when the icon finishes shrinking into it.
  iconSlot: {
    alignItems: 'center',
    height: ICON_HEADER_SIZE,
    justifyContent: 'center',
    width: '100%',
  },
  heading: {
    alignItems: 'center',
    marginTop: 14,
    maxWidth: 350,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.65,
    lineHeight: 31,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    // Matches the rating screen that follows this step, plus a little more air
    // so "Maybe later" reads as a separate, quieter choice.
    gap: 20,
    maxWidth: 360,
    width: '100%',
  },
  actionRow: {
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  shareButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
    width: '100%',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  laterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 24,
  },
  laterText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
