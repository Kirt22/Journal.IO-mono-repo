import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/provider';

const CONFETTI_PIECES = [
  { rotation: '-124deg', x: -78, y: -74 },
  { rotation: '88deg', x: -46, y: -118 },
  { rotation: '-82deg', x: -18, y: -92 },
  { rotation: '122deg', x: 20, y: -122 },
  { rotation: '-104deg', x: 62, y: -82 },
  { rotation: '98deg', x: 88, y: -46 },
  { rotation: '-96deg', x: -96, y: -38 },
  { rotation: '116deg', x: 42, y: -142 },
] as const;

type CelebrationConfettiProps = {
  /** Rising edge fires the burst once; falling edge resets it. */
  active: boolean;
};

/**
 * A one-shot upward burst for a genuine "that's done" moment. Decorative and
 * non-interactive; the caller is responsible for only firing it when the user
 * can actually see it.
 */
export default function CelebrationConfetti({
  active,
}: CelebrationConfettiProps) {
  const theme = useTheme();
  const pieces = useRef(
    CONFETTI_PIECES.map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!active) {
      pieces.forEach(value => value.setValue(0));
      return undefined;
    }

    const animation = Animated.parallel(
      pieces.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          delay: index * 28,
          duration: 640,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );

    animation.start();

    return () => animation.stop();
  }, [active, pieces]);

  if (!active) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.layer}>
      {CONFETTI_PIECES.map((piece, index) => (
        <Animated.View
          key={`${piece.rotation}-${piece.x}`}
          style={[
            styles.piece,
            {
              backgroundColor: [
                theme.colors.primary,
                theme.colors.accent,
                theme.colors.foreground,
              ][index % 3],
              opacity: pieces[index].interpolate({
                inputRange: [0, 0.12, 0.78, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateX: pieces[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, piece.x],
                  }),
                },
                {
                  translateY: pieces[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, piece.y],
                  }),
                },
                {
                  rotate: pieces[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', piece.rotation],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    height: 190,
    left: '50%',
    marginLeft: -120,
    marginTop: -95,
    position: 'absolute',
    top: '50%',
    width: 240,
  },
  piece: {
    borderRadius: 2,
    height: 8,
    left: '50%',
    marginLeft: -3,
    marginTop: -4,
    position: 'absolute',
    top: '58%',
    width: 6,
  },
});
