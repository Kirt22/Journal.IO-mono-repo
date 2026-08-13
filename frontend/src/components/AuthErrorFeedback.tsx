import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { CircleAlert } from 'lucide-react-native';
import PrimaryButton from './PrimaryButton';
import { useTheme } from '../theme/provider';

type AuthErrorNoticeProps = {
  message: string | null | undefined;
  testID?: string;
};

type AuthErrorDialogProps = {
  dismissLabel?: string;
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
  title: string;
  visible: boolean;
};

const NOTICE_DURATION = 200;
const DIALOG_EXIT_DURATION = 160;

const configureNoticeLayout = () => {
  LayoutAnimation.configureNext({
    duration: NOTICE_DURATION,
    create: {
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  });
};

function AuthErrorNotice({ message, testID }: AuthErrorNoticeProps) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(message ? 1 : 0)).current;
  const [renderedMessage, setRenderedMessage] = useState(message || null);
  const renderedMessageRef = useRef(message || null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    progress.stopAnimation();

    if (message) {
      if (!reduceMotion) {
        configureNoticeLayout();
      }
      renderedMessageRef.current = message;
      setRenderedMessage(message);
      AccessibilityInfo.announceForAccessibility(message);

      if (reduceMotion) {
        progress.setValue(1);
        return;
      }

      progress.setValue(0);
      Animated.timing(progress, {
        duration: NOTICE_DURATION,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!renderedMessageRef.current) {
      progress.setValue(0);
      return;
    }

    if (reduceMotion) {
      progress.setValue(0);
      renderedMessageRef.current = null;
      setRenderedMessage(null);
      return;
    }

    Animated.timing(progress, {
      duration: NOTICE_DURATION,
      easing: Easing.in(Easing.quad),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        configureNoticeLayout();
        renderedMessageRef.current = null;
        setRenderedMessage(null);
      }
    });
  }, [message, progress, reduceMotion]);

  if (!renderedMessage) {
    return null;
  }

  return (
    <Animated.View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      accessible
      testID={testID}
      style={[
        styles.notice,
        {
          backgroundColor: `${theme.colors.destructive}12`,
          borderColor: `${theme.colors.destructive}38`,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.noticeIcon,
          { backgroundColor: `${theme.colors.destructive}14` },
        ]}
      >
        <CircleAlert color={theme.colors.destructive} size={16} />
      </View>
      <Text style={[styles.noticeText, { color: theme.colors.destructive }]}>
        {renderedMessage}
      </Text>
    </Animated.View>
  );
}

function AuthErrorDialog({
  dismissLabel = 'Okay',
  message,
  onDismiss,
  onRetry,
  retryLabel = 'Try again',
  testID = 'auth-error-dialog',
  title,
  visible,
}: AuthErrorDialogProps) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [isMounted, setIsMounted] = useState(visible);
  const isMountedRef = useRef(visible);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    progress.stopAnimation();

    if (visible) {
      isMountedRef.current = true;
      setIsMounted(true);
      AccessibilityInfo.announceForAccessibility(`${title}. ${message}`);

      if (reduceMotion) {
        progress.setValue(1);
        return;
      }

      progress.setValue(0);
      Animated.spring(progress, {
        damping: 16,
        mass: 0.85,
        stiffness: 220,
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!isMountedRef.current) {
      progress.setValue(0);
      return;
    }

    if (reduceMotion) {
      progress.setValue(0);
      isMountedRef.current = false;
      setIsMounted(false);
      return;
    }

    Animated.timing(progress, {
      duration: DIALOG_EXIT_DURATION,
      easing: Easing.in(Easing.quad),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        isMountedRef.current = false;
        setIsMounted(false);
      }
    });
  }, [message, progress, reduceMotion, title, visible]);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onDismiss}
      transparent
      visible={isMounted}
    >
      <View style={styles.dialogRoot}>
        <Animated.View
          style={[
            styles.dialogScrim,
            {
              backgroundColor: `${theme.colors.foreground}66`,
              opacity: progress,
            },
          ]}
        >
          <HapticPressable
            accessibilityLabel={dismissLabel}
            accessibilityRole="button"
            onPress={onDismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          testID={testID}
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              opacity: progress,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.dialogIcon,
              { backgroundColor: `${theme.colors.destructive}14` },
            ]}
          >
            <CircleAlert color={theme.colors.destructive} size={22} />
          </View>
          <Text
            style={[styles.dialogTitle, { color: theme.colors.foreground }]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.dialogMessage,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {message}
          </Text>

          <View style={styles.dialogActions}>
            {onRetry ? (
              <View style={styles.dialogAction}>
                <PrimaryButton
                  label="Not now"
                  onPress={onDismiss}
                  size="sm"
                  variant="outline"
                />
              </View>
            ) : null}
            <View style={styles.dialogAction}>
              <PrimaryButton
                label={onRetry ? retryLabel : dismissLabel}
                onPress={onRetry || onDismiss}
                size="sm"
                tone="accent"
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  notice: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noticeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  dialogRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 16,
  },
  dialogIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  dialogMessage: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  dialogAction: {
    flex: 1,
  },
});

export { AuthErrorDialog, AuthErrorNotice };
export type { AuthErrorDialogProps, AuthErrorNoticeProps };
