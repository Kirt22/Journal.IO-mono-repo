import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  Appearance,
  Animated,
  Easing,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { getTheme, type AppTheme, type ThemePreference } from './theme';

const ThemeContext = createContext<AppTheme>(getTheme('light'));

type ThemeTransitionConfig = {
  originX?: number;
  originY?: number;
  nextModeOverride?: ThemePreference | null;
  onCovered?: () => void;
};

const THEME_COMMIT_DELAY_MS = 220;

const ThemeTransitionContext = createContext<
  (config?: ThemeTransitionConfig) => void
>(() => undefined);

type ThemeTransitionVisualState = {
  overlayColor: string;
  overlayGlowColor: string;
  rippleOpacity: Animated.Value;
  rippleOrigin: { x: number; y: number };
  rippleScale: Animated.Value;
};

const ThemeTransitionVisualContext =
  createContext<ThemeTransitionVisualState | null>(null);

type ThemeProviderProps = PropsWithChildren<{
  modeOverride?: ThemePreference | null;
}>;

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

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
  const preference =
    modeOverride ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const value = useMemo(() => getTheme(preference), [preference]);
  const rippleScale = useRef(new Animated.Value(0.01)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const transitionAnimationRef = useRef<Animated.CompositeAnimation | null>(
    null,
  );
  const themeCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [overlayColor, setOverlayColor] = useState(
    () => value.colors.background,
  );
  const [overlayGlowColor, setOverlayGlowColor] = useState(() =>
    hexToRgba(value.colors.primary, value.mode === 'dark' ? 0.18 : 0.12),
  );
  const [rippleOrigin, setRippleOrigin] = useState({
    x: windowDimensions.width / 2,
    y: windowDimensions.height / 2,
  });
  const [containerSize, setContainerSize] = useState({
    width: windowDimensions.width,
    height: windowDimensions.height,
  });
  const transitionVisualState = useMemo<ThemeTransitionVisualState>(
    () => ({
      overlayColor,
      overlayGlowColor,
      rippleOpacity,
      rippleOrigin,
      rippleScale,
    }),
    [overlayColor, overlayGlowColor, rippleOpacity, rippleOrigin, rippleScale],
  );

  useEffect(() => {
    Appearance.setColorScheme(modeOverride ? value.mode : 'unspecified');
  }, [modeOverride, value.mode]);

  useEffect(() => {
    return () => {
      if (themeCommitTimerRef.current) {
        clearTimeout(themeCommitTimerRef.current);
      }
    };
  }, []);

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
    if (themeCommitTimerRef.current) {
      clearTimeout(themeCommitTimerRef.current);
      themeCommitTimerRef.current = null;
    }
    const nextPreference =
      config?.nextModeOverride ?? (systemScheme === 'dark' ? 'dark' : 'light');
    const nextTheme = getTheme(nextPreference);
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
      hexToRgba(
        nextTheme.colors.primary,
        nextTheme.mode === 'dark' ? 0.2 : 0.14,
      ),
    );
    rippleScale.setValue(0.01);
    rippleOpacity.setValue(0);

    // Keep the current palette visible until the expanding next-theme surface
    // covers it. Switching immediately makes the ripple visually disappear.
    if (config?.onCovered) {
      themeCommitTimerRef.current = setTimeout(() => {
        themeCommitTimerRef.current = null;
        config.onCovered?.();
      }, THEME_COMMIT_DELAY_MS);
    }

    transitionAnimationRef.current = Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: targetScale,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rippleOpacity, {
          toValue: 1,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 300,
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
      <ThemeTransitionVisualContext.Provider value={transitionVisualState}>
        <ThemeContext.Provider value={value}>
          <View style={styles.root} onLayout={handleLayout}>
            {children}
            <ThemeTransitionOverlay />
          </View>
        </ThemeContext.Provider>
      </ThemeTransitionVisualContext.Provider>
    </ThemeTransitionContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeTransition() {
  return useContext(ThemeTransitionContext);
}

/** Renders the shared palette ripple inside a native modal layer when needed. */
export function ThemeTransitionOverlay() {
  const transition = useContext(ThemeTransitionVisualContext);
  const hostRef = useRef<View>(null);
  const [hostOrigin, setHostOrigin] = useState({ x: 0, y: 0 });

  if (!transition) {
    return null;
  }

  const {
    overlayColor,
    overlayGlowColor,
    rippleOpacity,
    rippleOrigin,
    rippleScale,
  } = transition;

  const updateHostOrigin = () => {
    hostRef.current?.measureInWindow((x, y) => {
      setHostOrigin(currentOrigin => {
        if (currentOrigin.x === x && currentOrigin.y === y) {
          return currentOrigin;
        }

        return { x, y };
      });
    });
  };

  return (
    <View
      ref={hostRef}
      pointerEvents="none"
      onLayout={updateHostOrigin}
      style={styles.rippleHost}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.rippleOverlay,
          {
            opacity: rippleOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.96],
            }),
            left: rippleOrigin.x - hostOrigin.x - 14,
            top: rippleOrigin.y - hostOrigin.y - 14,
            transform: [{ scale: rippleScale }],
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
            left: rippleOrigin.x - hostOrigin.x - 24,
            top: rippleOrigin.y - hostOrigin.y - 24,
            transform: [
              {
                scale: rippleScale.interpolate({
                  inputRange: [0.01, 1],
                  outputRange: [0.5, 1.1],
                  extrapolate: 'extend',
                }),
              },
            ],
            backgroundColor: overlayGlowColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFCFB',
  },
  rippleHost: {
    ...StyleSheet.absoluteFillObject,
  },
  rippleOverlay: {
    position: 'absolute',
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
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});
