import { Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { ADD_WIDGET_DEMO_VIDEO } from '../assets/video/addWidgetDemo';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Text } from '../infrastructure/reactNative';
import { ADD_WIDGET_STEPS } from '../screens/profile/widgetInstructions';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';
import HapticPressable from './HapticPressable';

// iPhone aspect. The frame flexes to fill whatever its parent leaves and then
// derives its width from this — so it grows on a tall device instead of being
// pinned to a fixed fraction of the window.
const PHONE_ASPECT = 9 / 19.5;
const PHONE_MAX_HEIGHT = 460;

// VoiceOver cannot read a screen recording, so the written steps stand in for it.
const WALKTHROUGH_LABEL = `Widget walkthrough. ${ADD_WIDGET_STEPS.join(' ')}`;

type Props = {
  /** Caps the phone frame; its width follows from the aspect ratio. */
  maxHeight?: number;
};

/**
 * The bundled "add a widget" screen recording, played muted and looping inside
 * a drawn iPhone frame.
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

  const [hasVideoError, setHasVideoError] = useState(false);
  // Reduce Motion means no autoplaying loop; the user opts in instead.
  const [isPaused, setIsPaused] = useState(reduceMotion);

  useEffect(() => {
    setIsPaused(reduceMotion);
  }, [reduceMotion]);

  const videoSource = ADD_WIDGET_DEMO_VIDEO;

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
      style={[
        styles.phoneFrame,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.foreground,
          maxHeight,
          shadowColor: theme.colors.foreground,
        },
      ]}
    >
      <View style={styles.phoneScreen}>
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

      <View
        pointerEvents="none"
        style={[styles.dynamicIsland, { backgroundColor: theme.colors.foreground }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dynamicIsland: {
    alignSelf: 'center',
    borderRadius: 9,
    height: 18,
    position: 'absolute',
    top: 8,
    width: 62,
    zIndex: 2,
  },
  phoneFrame: {
    aspectRatio: PHONE_ASPECT,
    borderRadius: 44,
    borderWidth: 6,
    flex: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
  },
  phoneScreen: {
    borderRadius: 38,
    flex: 1,
    overflow: 'hidden',
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
