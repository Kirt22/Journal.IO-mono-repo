import { Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Video from 'react-native-video';
import { ADD_WIDGET_DEMO_VIDEO } from '../assets/video/addWidgetDemo';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Text } from '../infrastructure/reactNative';
import { ADD_WIDGET_STEPS } from '../screens/profile/widgetInstructions';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';
import HapticPressable from './HapticPressable';

const PHONE_FRAME_SOURCE = require(
  '../assets/png/widgets/iphone-16-pro-white-titanium-frame.png',
);
const PHONE_FRAME_HEIGHT = 1309;
const PHONE_ASPECT = 633 / PHONE_FRAME_HEIGHT;
const PHONE_MAX_HEIGHT = 460;
const PHONE_SCREEN_CORNER_RADIUS = 90;

// VoiceOver cannot read a screen recording, so the written steps stand in for it.
const WALKTHROUGH_LABEL = `Widget walkthrough. ${ADD_WIDGET_STEPS.join(' ')}`;

type Props = {
  /** Caps the phone frame; its width follows from the aspect ratio. */
  maxHeight?: number;
};

/**
 * The bundled "add a widget" screen recording, played muted and looping inside
 * the supplied White Titanium iPhone frame.
 *
 * Shared by the onboarding widget step and the Settings > Widgets sheet so the
 * two surfaces show the same walkthrough. If the recording is missing or the
 * codec fails, this falls back to the written `ADD_WIDGET_STEPS` — the absent
 * case is a supported state, not a broken one.
 */
export default function AddWidgetDemoPhone({
  maxHeight = PHONE_MAX_HEIGHT,
}: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  const [frameHeight, setFrameHeight] = useState(maxHeight);
  const [hasVideoError, setHasVideoError] = useState(false);
  // Reduce Motion means no autoplaying loop; the user opts in instead.
  const [isPaused, setIsPaused] = useState(reduceMotion);

  useEffect(() => {
    setIsPaused(reduceMotion);
  }, [reduceMotion]);

  const videoSource = ADD_WIDGET_DEMO_VIDEO;
  const screenCornerRadius =
    (frameHeight / PHONE_FRAME_HEIGHT) * PHONE_SCREEN_CORNER_RADIUS;

  const handleFrameLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;

    setFrameHeight(currentHeight =>
      Math.abs(currentHeight - nextHeight) < 0.5 ? currentHeight : nextHeight,
    );
  };

  if (videoSource === null || hasVideoError) {
    return (
      <View style={styles.stepsFallback}>
        {ADD_WIDGET_STEPS.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <View
              style={[
                styles.stepNumber,
                { backgroundColor: theme.colors.primary + '1F' },
              ]}
            >
              <Text
                style={[styles.stepNumberText, { color: theme.colors.primary }]}
              >
                {index + 1}
              </Text>
            </View>
            <Text
              style={[styles.stepText, { color: theme.colors.foreground }]}
            >
              {step}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const showPlayButton = isPaused;

  return (
    <View
      // While the loop runs there is nothing to focus, so the frame itself
      // carries the steps. Paused, the play button owns the focus instead.
      accessible={!showPlayButton}
      accessibilityLabel={showPlayButton ? undefined : WALKTHROUGH_LABEL}
      onLayout={handleFrameLayout}
      style={[
        styles.phoneFrame,
        { maxHeight },
      ]}
      testID="add-widget-phone-container"
    >
      <Image
        accessible={false}
        resizeMode="contain"
        source={PHONE_FRAME_SOURCE}
        style={styles.frameArtwork}
        testID="add-widget-phone-frame"
      />

      <View
        style={[styles.phoneScreen, { borderRadius: screenCornerRadius }]}
        testID="add-widget-phone-screen"
      >
        <Video
          accessibilityElementsHidden
          importantForAccessibility="no"
          ignoreSilentSwitch="obey"
          muted
          onError={() => setHasVideoError(true)}
          paused={isPaused}
          playInBackground={false}
          playWhenInactive={false}
          repeat
          resizeMode="cover"
          // `{ uri }` rather than the bare asset: react-native-video resolves a
          // numeric `uri` the same way, and its types only accept this shape.
          source={{ uri: videoSource }}
          style={StyleSheet.absoluteFill}
          testID="add-widget-demo-video"
        />

        {showPlayButton ? (
          <HapticPressable
            accessibilityHint={WALKTHROUGH_LABEL}
            accessibilityLabel="Play the widget walkthrough"
            accessibilityRole="button"
            onPress={() => {
              triggerHaptic('secondaryAction').catch(() => undefined);
              setIsPaused(false);
            }}
            style={styles.playOverlay}
          >
            <View
              style={[
                styles.playBadge,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Play
                color={theme.colors.primaryForeground}
                fill={theme.colors.primaryForeground}
                size={20}
              />
            </View>
          </HapticPressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frameArtwork: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    width: '100%',
  },
  phoneFrame: {
    aspectRatio: PHONE_ASPECT,
    flex: 1,
  },
  phoneScreen: {
    bottom: '1.22%',
    left: '2.84%',
    overflow: 'hidden',
    position: 'absolute',
    right: '2.84%',
    top: '1.07%',
  },
  playBadge: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  stepsFallback: {
    gap: 16,
    width: '100%',
  },
});

export { PHONE_ASPECT, PHONE_MAX_HEIGHT };
