import HapticPressable from '../HapticPressable';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2 } from 'lucide-react-native';
import { Text,
} from '../../infrastructure/reactNative';
import { useTheme } from '../../theme/provider';
import { typography } from '../../theme/typography';
import { triggerHaptic } from '../../services/hapticsService';
import type { JadeSessionSummary } from '../../services/askJadeService';
import JournalLoader from '../JournalLoader';

const NEW_CHAT_ICON = require('../../assets/png/jade/icons8-new-chat-64.png');

/** Distance from the bottom that triggers the next page, as on the calendar. */
const LOAD_MORE_THRESHOLD = 280;
const DELETE_ACTION_WIDTH = 84;
const SWIPE_CLAIM_DISTANCE = 8;
const SWIPE_OPEN_DISTANCE = DELETE_ACTION_WIDTH * 0.4;

type JadeSessionsPanelProps = {
  visible: boolean;
  sessions: JadeSessionSummary[];
  activeSessionId: string | null;
  isLoading: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  reduceMotion: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onLoadMore: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRetry: () => void;
};

const formatRelativeDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = Math.floor((startOfToday - date.getTime()) / dayMs);

  if (date.getTime() >= startOfToday) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (daysAgo < 1) {
    return 'Yesterday';
  }
  if (daysAgo < 6) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

function JadeSessionRow({
  isActive,
  onDelete,
  onSelect,
  reduceMotion,
  session,
}: {
  isActive: boolean;
  onDelete: () => void;
  onSelect: () => void;
  reduceMotion: boolean;
  session: JadeSessionSummary;
}) {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const currentTranslateRef = useRef(0);
  const panStartRef = useRef(0);
  const drawerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(
    () => () => {
      drawerAnimationRef.current?.stop();
    },
    [],
  );

  const settleDrawer = useCallback(
    (open: boolean) => {
      const nextValue = open ? -DELETE_ACTION_WIDTH : 0;
      currentTranslateRef.current = nextValue;
      setDrawerVisible(open);
      drawerAnimationRef.current?.stop();

      if (reduceMotion || typeof jest !== 'undefined') {
        translateX.setValue(nextValue);
        return;
      }

      drawerAnimationRef.current = Animated.spring(translateX, {
        damping: 22,
        mass: 0.9,
        stiffness: 200,
        toValue: nextValue,
        useNativeDriver: true,
      });
      drawerAnimationRef.current.start();
    },
    [reduceMotion, translateX],
  );

  const handleDelete = useCallback(() => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    settleDrawer(false);
    Alert.alert(
      'Delete chat?',
      'Are you sure you want to delete this chat? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    );
  }, [onDelete, settleDrawer]);

  const handleSelect = useCallback(() => {
    if (currentTranslateRef.current < 0) {
      settleDrawer(false);
      return;
    }

    triggerHaptic('secondaryAction').catch(() => undefined);
    onSelect();
  }, [onSelect, settleDrawer]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > SWIPE_CLAIM_DISTANCE &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderGrant: () => {
      drawerAnimationRef.current?.stop();
      panStartRef.current = currentTranslateRef.current;
      setDrawerVisible(true);
    },
    onPanResponderMove: (_event, gesture) => {
      const nextValue = Math.max(
        -DELETE_ACTION_WIDTH,
        Math.min(0, panStartRef.current + gesture.dx),
      );
      currentTranslateRef.current = nextValue;
      translateX.setValue(nextValue);
    },
    onPanResponderRelease: (_event, gesture) => {
      const shouldOpen =
        gesture.vx < -0.35 ||
        (gesture.vx <= 0.35 &&
          Math.abs(currentTranslateRef.current) >= SWIPE_OPEN_DISTANCE);
      const wasOpen = panStartRef.current <= -SWIPE_OPEN_DISTANCE;
      if (shouldOpen !== wasOpen) {
        triggerHaptic('optionSelected').catch(() => undefined);
      }
      settleDrawer(shouldOpen);
    },
    onPanResponderTerminate: () => settleDrawer(false),
    onPanResponderTerminationRequest: () => false,
  });

  const title = session.title || 'Untitled chat';
  const deleteLabel = `Delete ${session.title || 'chat'}`;

  return (
    <View
      style={[styles.swipeShell, { backgroundColor: theme.colors.destructive }]}
      testID={`jade-session-row-${session.id}`}
    >
      <View
        accessibilityElementsHidden={!drawerVisible}
        importantForAccessibility={
          drawerVisible ? 'yes' : 'no-hide-descendants'
        }
        pointerEvents={drawerVisible ? 'auto' : 'none'}
        style={styles.deleteActionShell}
      >
        <HapticPressable
          accessibilityLabel={deleteLabel}
          accessibilityRole="button"
          onPress={handleDelete}
          style={({ pressed }) => [
            styles.deleteAction,
            pressed && styles.deletePressed,
          ]}
          testID={`jade-session-delete-${session.id}`}
        >
          <Trash2 color={theme.colors.destructiveForeground} size={18} />
          <Text
            style={[
              styles.deleteLabel,
              { color: theme.colors.destructiveForeground },
            ]}
          >
            Delete
          </Text>
        </HapticPressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.sessionSurface,
          {
            backgroundColor: theme.colors.card,
            borderColor: isActive ? theme.colors.primary : theme.colors.border,
            transform: [{ translateX }],
          },
        ]}
      >
        <HapticPressable
          accessibilityActions={[{ name: 'delete', label: deleteLabel }]}
          accessibilityHint="Swipe left to reveal delete."
          accessibilityLabel={session.title || 'Chat with Jade'}
          accessibilityRole="button"
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'delete') {
              handleDelete();
            }
          }}
          onPress={handleSelect}
          style={({ pressed }) => [
            styles.sessionRow,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.sessionMain}>
            <Text
              numberOfLines={1}
              style={[styles.sessionTitle, { color: theme.colors.foreground }]}
            >
              {title}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.sessionPreview,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {session.lastMessagePreview}
            </Text>
          </View>

          <Text
            style={[
              styles.sessionDate,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {formatRelativeDate(session.lastMessageAt)}
          </Text>
        </HapticPressable>
      </Animated.View>
    </View>
  );
}

function JadeSessionsPanel({
  visible,
  sessions,
  activeSessionId,
  isLoading,
  hasMore,
  errorMessage,
  reduceMotion,
  onClose,
  onSelectSession,
  onNewChat,
  onLoadMore,
  onDeleteSession,
  onRetry,
}: JadeSessionsPanelProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const slide = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);
  const isClosingRef = useRef(false);
  const [isModalVisible, setIsModalVisible] = useState(visible);

  // Guards against the scroll handler firing several times before the request
  // in flight resolves.
  const isLoadingMoreRef = useRef(false);
  isLoadingMoreRef.current = isLoading;

  useEffect(() => {
    let entranceFrame: number | null = null;

    const animateSheet = (toVisible: boolean, onFinished?: () => void) => {
      if (reduceMotion || typeof jest !== 'undefined') {
        slide.setValue(toVisible ? 1 : 0);
        scrimOpacity.setValue(toVisible ? 1 : 0);
        onFinished?.();
        return;
      }

      Animated.parallel([
        Animated.timing(slide, {
          duration: toVisible ? 320 : 220,
          easing: toVisible
            ? Easing.out(Easing.cubic)
            : Easing.in(Easing.cubic),
          toValue: toVisible ? 1 : 0,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          duration: toVisible ? 240 : 180,
          easing: Easing.inOut(Easing.ease),
          toValue: toVisible ? 1 : 0,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onFinished?.();
        }
      });
    };

    if (visible && !wasVisibleRef.current) {
      setIsModalVisible(true);
      isClosingRef.current = false;
      slide.setValue(0);
      scrimOpacity.setValue(0);
      entranceFrame = requestAnimationFrame(() => animateSheet(true));
    }

    if (!visible && wasVisibleRef.current && !isClosingRef.current) {
      isClosingRef.current = true;
      animateSheet(false, () => {
        setIsModalVisible(false);
        isClosingRef.current = false;
      });
    }

    wasVisibleRef.current = visible;

    return () => {
      if (entranceFrame !== null) {
        cancelAnimationFrame(entranceFrame);
      }
    };
  }, [reduceMotion, scrimOpacity, slide, visible]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasMore || isLoadingMoreRef.current) {
        return;
      }

      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;

      if (distanceFromBottom < LOAD_MORE_THRESHOLD) {
        onLoadMore();
      }
    },
    [hasMore, onLoadMore],
  );

  const handleNewChat = () => {
    triggerHaptic('primaryAction').catch(() => undefined);
    onNewChat();
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={isModalVisible}
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { opacity: scrimOpacity }]}
          testID="jade-sessions-scrim"
        >
          <HapticPressable
            accessibilityLabel="Close previous chats"
            accessibilityRole="button"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              paddingBottom: insets.bottom + 20,
              paddingHorizontal: horizontalPadding,
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [height, 0],
                  }),
                },
              ],
            },
          ]}
          testID="jade-sessions-sheet"
        >
          <View style={styles.grabberRow}>
            <View
              style={[styles.grabber, { backgroundColor: theme.colors.border }]}
            />
          </View>

          <Text style={[styles.title, { color: theme.colors.foreground }]}>
            Previous chats
          </Text>

          <HapticPressable
            accessibilityLabel="Start a new chat"
            accessibilityRole="button"
            onPress={handleNewChat}
            style={({ pressed }) => [
              styles.newChatRow,
              { borderColor: theme.colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              source={NEW_CHAT_ICON}
              style={styles.newChatIcon}
              testID="jade-new-chat-icon"
            />
            <Text
              style={[styles.newChatLabel, { color: theme.colors.foreground }]}
            >
              New chat
            </Text>
          </HapticPressable>

          <ScrollView
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          >
            {sessions.length === 0 && !isLoading ? (
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Your chats with Jade will show up here.
              </Text>
            ) : null}

            {sessions.map(session => (
              <JadeSessionRow
                isActive={session.id === activeSessionId}
                key={session.id}
                onDelete={() => onDeleteSession(session.id)}
                onSelect={() => onSelectSession(session.id)}
                reduceMotion={reduceMotion}
                session={session}
              />
            ))}

            {isLoading ? (
              <View style={styles.footerRow}>
                <JournalLoader color={theme.colors.primary} size="small" />
                <Text
                  style={[
                    styles.footerText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Loading chats…
                </Text>
              </View>
            ) : null}

            {errorMessage && !isLoading ? (
              <View style={styles.footerRow}>
                <Text
                  style={[
                    styles.footerText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {errorMessage}
                </Text>
                <HapticPressable
                  accessibilityRole="button"
                  onPress={onRetry}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text
                    style={[styles.retryText, { color: theme.colors.primary }]}
                  >
                    Try again
                  </Text>
                </HapticPressable>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 42, 38, 0.32)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '72%',
    overflow: 'hidden',
    paddingTop: 8,
  },
  grabberRow: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  grabber: {
    borderRadius: 2,
    height: 4,
    width: 40,
  },
  title: {
    ...typography.title,
    paddingBottom: 16,
  },
  newChatRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  newChatIcon: {
    height: 24,
    resizeMode: 'contain',
    width: 24,
  },
  newChatLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  emptyText: {
    ...typography.bodySm,
    paddingVertical: 24,
    textAlign: 'center',
  },
  swipeShell: {
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  deleteActionShell: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: DELETE_ACTION_WIDTH,
  },
  deleteAction: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    justifyContent: 'center',
  },
  deleteLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  deletePressed: {
    opacity: 0.82,
  },
  sessionSurface: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sessionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sessionMain: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  sessionTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  sessionPreview: {
    ...typography.caption,
  },
  sessionDate: {
    ...typography.caption,
  },
  footerRow: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  footerText: {
    ...typography.caption,
    textAlign: 'center',
  },
  retryText: {
    ...typography.caption,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});

export default JadeSessionsPanel;
