import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { getTheme, type AppTheme, type ThemeMode } from "./theme";

const ThemeContext = createContext<AppTheme>(getTheme("light"));

type ThemeTransitionConfig = {
  originX?: number;
  originY?: number;
  nextModeOverride?: ThemeMode | null;
};

const ThemeTransitionContext = createContext<
  (config?: ThemeTransitionConfig) => void
>(() => undefined);

type ThemeProviderProps = PropsWithChildren<{
  modeOverride?: ThemeMode | null;
}>;

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function ThemeProvider({
  children,
  modeOverride = null,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const windowDimensions = useWindowDimensions();
  const mode = modeOverride ?? (systemScheme === "dark" ? "dark" : "light");
  const value = useMemo(() => getTheme(mode), [mode]);
  const rippleScale = useRef(new Animated.Value(0.01)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const transitionAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [overlayColor, setOverlayColor] = useState(() => value.colors.background);
  const [overlayGlowColor, setOverlayGlowColor] = useState(() =>
    hexToRgba(value.colors.primary, value.mode === "dark" ? 0.18 : 0.12)
  );
  const [rippleOrigin, setRippleOrigin] = useState({
    x: windowDimensions.width / 2,
    y: windowDimensions.height / 2,
  });
  const [containerSize, setContainerSize] = useState({
    width: windowDimensions.width,
    height: windowDimensions.height,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setContainerSize(currentValue => {
      if (currentValue.width === width && currentValue.height === height) {
        return currentValue;
      }

      return { width, height };
    });
  };

  const startThemeTransition = (config?: ThemeTransitionConfig) => {
    transitionAnimationRef.current?.stop();
    const nextMode =
      config?.nextModeOverride ?? (systemScheme === "dark" ? "dark" : "light");
    const nextTheme = getTheme(nextMode);
    const width = containerSize.width || windowDimensions.width || 1;
    const height = containerSize.height || windowDimensions.height || 1;
    const originX = config?.originX ?? width / 2;
    const originY = config?.originY ?? height / 2;
    const maxHorizontal = Math.max(originX, width - originX);
    const maxVertical = Math.max(originY, height - originY);
    const maxDistance = Math.sqrt(maxHorizontal ** 2 + maxVertical ** 2);
    const baseRippleSize = 28;
    const targetScale = Math.max(maxDistance / (baseRippleSize / 2), 1);

    setRippleOrigin({ x: originX, y: originY });
    setOverlayColor(nextTheme.colors.background);
    setOverlayGlowColor(
      hexToRgba(nextTheme.colors.primary, nextTheme.mode === "dark" ? 0.2 : 0.14)
    );
    rippleScale.setValue(0.01);
    rippleOpacity.setValue(0);

    transitionAnimationRef.current = Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: targetScale,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rippleOpacity, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    transitionAnimationRef.current.start(() => {
      transitionAnimationRef.current = null;
      rippleScale.setValue(0.01);
      rippleOpacity.setValue(0);
    });
  };

  return (
    <ThemeTransitionContext.Provider value={startThemeTransition}>
      <ThemeContext.Provider value={value}>
        <View style={styles.root} onLayout={handleLayout}>
          {children}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rippleOverlay,
              {
                opacity: rippleOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.96],
                }),
                left: rippleOrigin.x - 14,
                top: rippleOrigin.y - 14,
                transform: [
                  { scale: rippleScale },
                ],
                backgroundColor: overlayColor,
                shadowColor: overlayGlowColor,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rippleGlow,
              {
                opacity: rippleOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.55],
                }),
                left: rippleOrigin.x - 24,
                top: rippleOrigin.y - 24,
                transform: [
                  {
                    scale: rippleScale.interpolate({
                      inputRange: [0.01, 1],
                      outputRange: [0.5, 1.1],
                      extrapolate: "extend",
                    }),
                  },
                ],
                backgroundColor: overlayGlowColor,
              },
            ]}
          />
        </View>
      </ThemeContext.Provider>
    </ThemeTransitionContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeTransition() {
  return useContext(ThemeTransitionContext);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rippleOverlay: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 2,
  },
  rippleGlow: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});
