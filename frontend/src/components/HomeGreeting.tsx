import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { ChevronRight, Crown, Sparkles } from 'lucide-react-native';
import CelebrationConfetti from './CelebrationConfetti';
import EmojiWithFallback from './EmojiWithFallback';
import { useTheme } from '../theme/provider';
import type { HomeNudge, HomeNudgeIcon } from '../utils/homeNudge';

type HomeGreetingProps = {
  greeting: string;
  firstName: string;
  nudge: HomeNudge;
  date: string;
  onPress: () => void;
  /** False under Reduce Motion or in tests; everything renders settled. */
  shouldAnimate: boolean;
  /** Fires the one-shot burst as the offer nudge takes over the tag. */
  celebrate?: boolean;
  isCompact?: boolean;
  isWide?: boolean;
};

/**
 * Full-colour icons8 artwork, matching the Settings row set. They carry their own
 * palette, so the tag does not tint them. The streak and reflection entries reuse
 * assets already in the app so the whole row stays one visual family rather than
 * mixing illustrated icons with line icons.
 */
const NUDGE_ICONS: Partial<Record<HomeNudgeIcon, ImageSourcePropType>> = {
  flame: require('../assets/png/streaks/streak-fire.png'),
  mood: require('../assets/png/home/icons8-mood-64.png'),
  goals: require('../assets/png/home/icons8-bullseye-100.png'),
  reflection: require('../assets/png/home/reflection.png'),
  'quick-thought': require('../assets/png/home/icons8-pen-40.png'),
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/**
 * The block under the orb: date, the greeting, and a tappable tag.
 *
 * The greeting is permanent — only the tag rotates through the nudge ladder — so
 * the two animate separately. The block pops in once on entrance using the
 * conditional-action spring from docs/UI_IMPLEMENTATION_STANDARDS.md, and after
 * that only the tag re-animates when the nudge changes. Popping the whole block
 * would animate a headline that did not move.
 */
export default function HomeGreeting({
  greeting,
  firstName,
  nudge,
  date,
  onPress,
  shouldAnimate,
  celebrate = false,
  isCompact = false,
  isWide = false,
}: HomeGreetingProps) {
  const theme = useTheme();
  const popProgress = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const tagProgress = useRef(new Animated.Value(1)).current;
  const waveRotation = useRef(new Animated.Value(0)).current;
  const hasMountedRef = useRef(false);
  const iconSource = NUDGE_ICONS[nudge.icon];
  const headlineSize = isCompact ? 22 : isWide ? 26 : 24;
  const headline = firstName ? `${greeting}, ${firstName}` : greeting;

  useEffect(() => {
    if (!shouldAnimate) {
      popProgress.setValue(1);
      return;
    }

    popProgress.setValue(0);

    const animation = Animated.spring(popProgress, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [popProgress, shouldAnimate]);

  useEffect(() => {
    // The first render is covered by the block's own pop-in; only settle the tag
    // on later changes, and only when the nudge actually becomes a different one.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (!shouldAnimate) {
      tagProgress.setValue(1);
      return;
    }

    tagProgress.setValue(0);

    const animation = Animated.spring(tagProgress, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [nudge.kind, shouldAnimate, tagProgress]);

  useEffect(() => {
    if (!shouldAnimate) {
      waveRotation.setValue(0);
      return;
    }

    const animation = Animated.sequence([
      Animated.delay(180),
      Animated.timing(waveRotation, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(waveRotation, {
        toValue: -1,
        duration: 150,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(waveRotation, {
        toValue: 1,
        duration: 150,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(waveRotation, {
        toValue: 0,
        damping: 6,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [shouldAnimate, waveRotation]);

  const popStyle = {
    opacity: popProgress,
    transform: [
      {
        translateY: popProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: popProgress.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0.96, 1.035, 1],
        }),
      },
    ],
  };

  const tagStyle = {
    opacity: tagProgress,
    transform: [
      {
        scale: tagProgress.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0.94, 1.035, 1],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.block, popStyle]} testID="home-greeting">
      <Text style={[styles.date, { color: theme.colors.mutedForeground }]}>
        {date}
      </Text>

      <View style={styles.headlineRow}>
        <Text
          numberOfLines={2}
          style={[
            styles.headline,
            { color: theme.colors.foreground, fontSize: headlineSize },
          ]}
        >
          {headline}
        </Text>

        <Animated.View
          style={{
            transform: [
              {
                rotate: waveRotation.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-18deg', '18deg'],
                }),
              },
            ],
          }}
        >
          <EmojiWithFallback
            emoji="👋"
            emojiStyle={[styles.wave, { fontSize: headlineSize - 4 }]}
            fallbackIcon={Sparkles}
            fallbackIconColor={theme.colors.warning}
            fallbackIconSize={headlineSize - 6}
          />
        </Animated.View>
      </View>

      <Animated.View style={tagStyle}>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel={nudge.label}
          onPress={onPress}
          style={({ pressed }) => [
            styles.tag,
            {
              backgroundColor: hexToRgba(theme.colors.primary, 0.09),
              borderColor: hexToRgba(theme.colors.primary, 0.22),
            },
            pressed && styles.pressed,
          ]}
          testID="home-greeting-action"
        >
          {iconSource ? (
            <Image source={iconSource} style={styles.tagIcon} />
          ) : (
            // The offer has no illustrated counterpart in the icons8 set, so it
            // borrows the crown the retired offer card used.
            <Crown color={theme.colors.primary} size={16} />
          )}
          <Text style={[styles.tagLabel, { color: theme.colors.primary }]}>
            {nudge.label}
          </Text>
          <ChevronRight color={theme.colors.primary} size={15} />
        </HapticPressable>
        <CelebrationConfetti active={celebrate && shouldAnimate} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  date: {
    fontSize: 12,
  },
  headlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  headline: {
    flexShrink: 1,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  wave: {
    lineHeight: 30,
  },
  tag: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  tagIcon: {
    height: 18,
    resizeMode: 'contain',
    width: 18,
  },
  tagLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
