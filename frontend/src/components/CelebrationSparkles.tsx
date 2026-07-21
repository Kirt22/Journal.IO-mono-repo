import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type CelebrationSparklesProps = {
  active?: boolean;
};

type SparkleParticle = {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
};

const particles: SparkleParticle[] = [
  { left: "10%", top: "32%", size: 5 },
  { left: "22%", top: "14%", size: 4 },
  { left: "74%", top: "18%", size: 6 },
  { left: "85%", top: "42%", size: 4 },
  { left: "62%", top: "76%", size: 5 },
  { left: "18%", top: "72%", size: 4 },
];

export default function CelebrationSparkles({
  active = true,
}: CelebrationSparklesProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      shimmer.stopAnimation();
      shimmer.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [active, shimmer]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle, index) => (
        <Animated.View
          key={`${particle.left}-${particle.top}`}
          style={[
            styles.particle,
            {
              height: particle.size,
              left: particle.left,
              opacity: shimmer.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.22, 0.95, 0.35],
              }),
              top: particle.top,
              transform: [
                {
                  translateY: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, index % 2 === 0 ? -7 : 7],
                  }),
                },
                {
                  scale: shimmer.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.9, 1.25, 0.92],
                  }),
                },
              ],
              width: particle.size,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    backgroundColor: "#F0B45E",
    borderRadius: 999,
    position: "absolute",
  },
});
