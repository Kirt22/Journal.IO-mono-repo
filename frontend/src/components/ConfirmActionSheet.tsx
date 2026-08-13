import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import ButtonLoadingContent from './ButtonLoadingContent';
import { useTheme } from '../theme/provider';

type ConfirmActionSheetProps = {
  visible: boolean;
  title: string;
  body?: string;
  /** Top button — filled with the primary colour. The "keep going" choice. */
  primaryLabel: string;
  /** Bottom button — outlined and unhighlighted. The committing choice. */
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onDismiss: () => void;
  isSecondaryLoading?: boolean;
  /** Replaces the default spinner while the secondary action runs. */
  secondaryLoader?: ReactNode;
  dismissAccessibilityLabel?: string;
};

/**
 * The confirm-before-committing sheet shared by the guided reflection finish
 * step and the open-ended composer. The emphasis is deliberately inverted from
 * a normal dialog: the top, highlighted button keeps the user writing, and the
 * quieter bottom button ends the session.
 */
export default function ConfirmActionSheet({
  visible,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onDismiss,
  isSecondaryLoading = false,
  secondaryLoader,
  dismissAccessibilityLabel = 'Dismiss confirmation',
}: ConfirmActionSheetProps) {
  const theme = useTheme();
  const slide = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!visible) {
      if (!mountedRef.current) {
        return undefined;
      }

      const closingAnimation = Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 230,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      closingAnimation.start(({ finished }) => {
        if (!finished) {
          return;
        }

        mountedRef.current = false;
        setIsMounted(false);
      });

      return () => closingAnimation.stop();
    }

    if (mountedRef.current) {
      return undefined;
    }

    mountedRef.current = true;
    slide.setValue(0);
    scrimOpacity.setValue(0);
    setIsMounted(true);
    const frameId = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => cancelAnimationFrame(frameId);
  }, [scrimOpacity, slide, visible]);

  return (
    <Modal
      animationType="none"
      onRequestClose={onDismiss}
      transparent
      visible={isMounted}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.modalScrim, { opacity: scrimOpacity }]}>
          <HapticPressable
            accessibilityLabel={dismissAccessibilityLabel}
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [340, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[styles.grabber, { backgroundColor: theme.colors.border }]}
          />
          <Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>
            {title}
          </Text>
          {body ? (
            <Text
              style={[
                styles.sheetBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {body}
            </Text>
          ) : null}
          <HapticPressable
            accessibilityLabel={primaryLabel}
            accessibilityRole="button"
            onPress={onPrimary}
            style={({ pressed }) => [
              styles.sheetPrimaryButton,
              { backgroundColor: theme.colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.primaryForeground },
              ]}
            >
              {primaryLabel}
            </Text>
          </HapticPressable>
          <HapticPressable
            accessibilityLabel={secondaryLabel}
            accessibilityRole="button"
            accessibilityState={{ busy: isSecondaryLoading }}
            disabled={isSecondaryLoading}
            onPress={onSecondary}
            style={({ pressed }) => [
              styles.sheetSecondaryButton,
              {
                backgroundColor: theme.colors.secondary,
                borderColor: theme.colors.border,
              },
              pressed && !isSecondaryLoading && styles.pressed,
            ]}
          >
            <ButtonLoadingContent
              loader={secondaryLoader}
              loaderColor={theme.colors.foreground}
              loading={isSecondaryLoading}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.colors.foreground },
                ]}
              >
                {secondaryLabel}
              </Text>
            </ButtonLoadingContent>
          </HapticPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    marginTop: 'auto',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: 18,
    width: 42,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 28,
    marginBottom: 8,
    textAlign: 'center',
  },
  sheetBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetPrimaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 52,
  },
  sheetSecondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 52,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
});
