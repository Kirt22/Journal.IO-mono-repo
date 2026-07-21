import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/provider';
import JournalWordmark, {
  type JournalWordmarkIntroResult,
} from './JournalWordmark';

type AuthHeroProps = {
  title: string;
  subtitle: string;
  titleSize?: number;
  subtitleMaxWidth?: number;
  playWordmarkIntro?: boolean;
  onWordmarkIntroStart?: () => void;
  onWordmarkMergeComplete?: (result: JournalWordmarkIntroResult) => void;
  onWordmarkIntroComplete?: (result: JournalWordmarkIntroResult) => void;
  children?: ReactNode;
  badge?: ReactNode;
};

export default function AuthHero({
  title,
  subtitle,
  titleSize = 28,
  subtitleMaxWidth = 340,
  playWordmarkIntro = false,
  onWordmarkIntroStart,
  onWordmarkMergeComplete,
  onWordmarkIntroComplete,
  children,
  badge,
}: AuthHeroProps) {
  const theme = useTheme();
  const shouldAnimateSubtitle = playWordmarkIntro;
  const subtitleEntrance = useRef(
    new Animated.Value(shouldAnimateSubtitle ? 0 : 1),
  ).current;
  const subtitleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasCompletedSubtitleRef = useRef(!shouldAnimateSubtitle);
  const onWordmarkIntroCompleteRef = useRef(onWordmarkIntroComplete);
  const [isSubtitleAccessible, setIsSubtitleAccessible] = useState(
    !shouldAnimateSubtitle,
  );
  const showsDuplicateBrandTitle = title.trim().toLowerCase() === 'journal.io';

  useEffect(
    () => () => {
      subtitleAnimationRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    onWordmarkIntroCompleteRef.current = onWordmarkIntroComplete;
  }, [onWordmarkIntroComplete]);

  const completeSubtitle = useCallback(
    (result: JournalWordmarkIntroResult) => {
      if (hasCompletedSubtitleRef.current) {
        return;
      }

      hasCompletedSubtitleRef.current = true;
      subtitleAnimationRef.current?.stop();
      subtitleEntrance.setValue(1);
      setIsSubtitleAccessible(true);
      onWordmarkIntroCompleteRef.current?.(result);
    },
    [subtitleEntrance],
  );

  useEffect(() => {
    if (!shouldAnimateSubtitle) {
      return;
    }

    let isActive = true;
    const handleReduceMotion = (enabled: boolean) => {
      if (isActive && enabled) {
        completeSubtitle({ animated: false, outcome: 'reduced-motion' });
      }
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(handleReduceMotion)
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      handleReduceMotion,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [completeSubtitle, shouldAnimateSubtitle]);

  const handleWordmarkMergeComplete = useCallback(
    (result: JournalWordmarkIntroResult) => {
      subtitleAnimationRef.current?.stop();
      onWordmarkMergeComplete?.(result);

      if (result.animated && !hasCompletedSubtitleRef.current) {
        subtitleAnimationRef.current = Animated.timing(subtitleEntrance, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        subtitleAnimationRef.current.start(({ finished }) => {
          if (finished) {
            completeSubtitle(result);
          }
        });
      } else {
        completeSubtitle(result);
      }
    },
    [completeSubtitle, onWordmarkMergeComplete, subtitleEntrance],
  );

  const subtitleEntranceStyle = {
    opacity: subtitleEntrance,
    transform: [
      {
        translateY: subtitleEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  } as const;

  return (
    <View style={styles.container}>
      <JournalWordmark
        playInkCurrentIntro={playWordmarkIntro}
        onIntroStart={onWordmarkIntroStart}
        onIntroMergeComplete={handleWordmarkMergeComplete}
      />
      {!showsDuplicateBrandTitle ? (
        <Text
          style={[
            styles.title,
            { color: theme.colors.foreground, fontSize: titleSize },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <Animated.Text
        accessibilityElementsHidden={!isSubtitleAccessible}
        importantForAccessibility={
          isSubtitleAccessible ? 'auto' : 'no-hide-descendants'
        }
        style={[
          styles.subtitle,
          { color: theme.colors.mutedForeground, maxWidth: subtitleMaxWidth },
          subtitleEntranceStyle,
        ]}
      >
        {subtitle}
      </Animated.Text>

      {badge ? <View style={styles.badgeWrap}>{badge}</View> : null}
      {children ? <View style={styles.childrenWrap}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badgeWrap: {
    marginTop: 12,
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 14,
  },
  childrenWrap: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
});
