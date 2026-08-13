import HapticPressable from '../../components/HapticPressable';
import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MoreHorizontal, Send } from 'lucide-react-native';
import { Text, TextInput } from '../../infrastructure/reactNative';
import { useTheme } from '../../theme/provider';
import { typography } from '../../theme/typography';
import { useAppStore } from '../../store/appStore';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { triggerHaptic } from '../../services/hapticsService';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import ShimmerBlock from '../../components/ShimmerBlock';
import JournalLoader from '../../components/JournalLoader';
import JadeSessionsPanel from '../../components/jade/JadeSessionsPanel';
import JadeMessageContent from '../../components/jade/JadeMessageContent';
import type { JadeThreadMessage } from '../../store/slices/askJadeSlice';

const JADE_ICON = require('../../assets/png/jade/jade-gem.png');

const MESSAGE_MAX_LENGTH = 2000;
/** Distance from the top that pulls in older turns, mirroring the calendar. */
const LOAD_OLDER_THRESHOLD = 280;
const TYPEWRITER_CHUNK_MS = 28;
const THINKING_DOT_MS = 160;

const STARTER_PROMPTS = [
  'What patterns have you noticed in me?',
  'Show me my mood trends as a graph.',
  "I've had a hard week.",
];

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

function MessageEntrance({
  animate,
  children,
  messageId,
  reduceMotion,
}: {
  animate: boolean;
  children: ReactNode;
  messageId: string;
  reduceMotion: boolean;
}) {
  const progress = useRef(
    new Animated.Value(animate && !reduceMotion ? 0 : 1),
  ).current;

  useEffect(() => {
    if (!animate || reduceMotion || typeof jest !== 'undefined') {
      progress.setValue(1);
      return undefined;
    }

    const animation = Animated.timing(progress, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [animate, progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.messageEntrance,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
      testID={`ask-jade-message-${messageId}`}
    >
      {children}
    </Animated.View>
  );
}

function JadeThinkingIndicator({
  color,
  reduceMotion,
}: {
  color: string;
  reduceMotion: boolean;
}) {
  const [firstDot, secondDot, thirdDot] = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    firstDot.setValue(1);
    secondDot.setValue(1);
    thirdDot.setValue(1);

    if (reduceMotion || typeof jest !== 'undefined') {
      return undefined;
    }

    const fade = (dot: Animated.Value, toValue: number) =>
      Animated.timing(dot, {
        duration: THINKING_DOT_MS,
        easing: Easing.inOut(Easing.ease),
        toValue,
        useNativeDriver: true,
      });
    const animation = Animated.loop(
      Animated.sequence([
        fade(firstDot, 0),
        Animated.parallel([fade(firstDot, 1), fade(secondDot, 0)]),
        Animated.parallel([fade(secondDot, 1), fade(thirdDot, 0)]),
        fade(thirdDot, 1),
        Animated.delay(120),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [firstDot, reduceMotion, secondDot, thirdDot]);

  return (
    <View
      accessibilityLabel="Jade is thinking"
      accessible
      style={styles.thinkingContent}
    >
      <Text style={[styles.typingText, { color }]}>Jade is thinking</Text>
      <View accessibilityElementsHidden style={styles.thinkingDots}>
        {[firstDot, secondDot, thirdDot].map((opacity, index) => (
          <Animated.View
            key={index}
            style={[styles.thinkingDot, { backgroundColor: color, opacity }]}
            testID={`ask-jade-thinking-dot-${index + 1}`}
          />
        ))}
      </View>
    </View>
  );
}

type AskJadeScreenProps = {
  onBack: () => void;
  isPremium: boolean;
  onUpgrade: () => void;
};

function AskJadeScreen({ onBack, isPremium, onUpgrade }: AskJadeScreenProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const layoutMaxWidth = isWide ? 460 : 420;

  const { status: connectivityStatus } = useConnectivity();
  const isOffline = connectivityStatus === 'offline';

  const jadeSessionId = useAppStore(state => state.jadeSessionId);
  const jadeMessages = useAppStore(state => state.jadeMessages);
  const jadeSessions = useAppStore(state => state.jadeSessions);
  const jadeSessionsHasMore = useAppStore(state => state.jadeSessionsHasMore);
  const isLoadingJadeThread = useAppStore(state => state.isLoadingJadeThread);
  const isLoadingOlder = useAppStore(state => state.isLoadingOlderJadeMessages);
  const isLoadingJadeSessions = useAppStore(
    state => state.isLoadingJadeSessions,
  );
  const isSendingJadeMessage = useAppStore(state => state.isSendingJadeMessage);
  const jadeThreadError = useAppStore(state => state.jadeThreadError);
  const jadeSessionsError = useAppStore(state => state.jadeSessionsError);
  const jadeLocked = useAppStore(state => state.jadeLocked);
  const jadeLimitResetAt = useAppStore(state => state.jadeLimitResetAt);

  const startNewJadeChat = useAppStore(state => state.startNewJadeChat);
  const openJadeSession = useAppStore(state => state.openJadeSession);
  const loadOlderJadeMessages = useAppStore(
    state => state.loadOlderJadeMessages,
  );
  const sendJadeChatMessage = useAppStore(state => state.sendJadeChatMessage);
  const loadJadeSessions = useAppStore(state => state.loadJadeSessions);
  const loadMoreJadeSessions = useAppStore(state => state.loadMoreJadeSessions);
  const removeJadeSession = useAppStore(state => state.removeJadeSession);

  const [draft, setDraft] = useState('');
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const draftReveal = useRef(new Animated.Value(1)).current;
  const shouldAnimateNextReplyRef = useRef(false);
  const isOpeningHistoryRef = useRef(false);
  const historyScrollResetFrameRef = useRef<number | null>(null);

  // The locked state is driven by the entitlement the app already knows AND by
  // a 403 arriving mid-session, since entitlements can lapse while the screen
  // is open.
  const isLocked = !isPremium || jadeLocked;

  const isLimitReached = useMemo(() => {
    if (!jadeLimitResetAt) {
      return false;
    }
    const resetAt = new Date(jadeLimitResetAt).getTime();
    return Number.isFinite(resetAt) && resetAt > Date.now();
  }, [jadeLimitResetAt]);

  useEffect(() => {
    if (isLocked) {
      return;
    }
    loadJadeSessions().catch(() => undefined);
  }, [isLocked, loadJadeSessions]);

  // ── Typewriter ───────────────────────────────────────────────────────────
  // There is no streaming transport in the app; the full reply arrives at once
  // and is revealed word by word, as in the guided reflection thread.
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [streamedText, setStreamedText] = useState('');
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealedIdsRef = useRef<Set<string>>(new Set());

  const stopTypewriter = useCallback(() => {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopTypewriter, [stopTypewriter]);

  useEffect(
    () => () => {
      if (historyScrollResetFrameRef.current !== null) {
        cancelAnimationFrame(historyScrollResetFrameRef.current);
      }
    },
    [],
  );

  const latestMessage = jadeMessages[jadeMessages.length - 1];

  useEffect(() => {
    if (
      !latestMessage ||
      latestMessage.role !== 'assistant' ||
      revealedIdsRef.current.has(latestMessage.id)
    ) {
      return;
    }

    revealedIdsRef.current.add(latestMessage.id);

    // Replies restored with a saved session are already complete. Only a reply
    // requested from this mounted composer should replay the reveal treatment.
    if (!shouldAnimateNextReplyRef.current) {
      setStreamingMessageId(null);
      setStreamedText('');
      return;
    }
    shouldAnimateNextReplyRef.current = false;

    // Crisis copy appears at once — never dribbled out a word at a time.
    if (latestMessage.status === 'support_first') {
      return;
    }

    const textBlock = (latestMessage.blocks || []).find(
      block => block.type === 'text',
    );
    const prose =
      textBlock?.type === 'text' ? textBlock.text : latestMessage.text;
    const chunks = prose.match(/\S+\s*/g) || [prose];
    let index = 0;

    setStreamingMessageId(latestMessage.id);
    setStreamedText('');

    const revealNext = () => {
      index += 1;
      setStreamedText(chunks.slice(0, index).join(''));
      scrollRef.current?.scrollToEnd({ animated: true });

      if (index < chunks.length) {
        typewriterTimerRef.current = setTimeout(
          revealNext,
          TYPEWRITER_CHUNK_MS,
        );
        return;
      }
      setStreamingMessageId(null);
    };

    revealNext();

    return stopTypewriter;
  }, [latestMessage, stopTypewriter]);

  // ── Composer ─────────────────────────────────────────────────────────────
  const trimmedDraft = draft.trim();
  const canSend =
    Boolean(trimmedDraft) &&
    !isSendingJadeMessage &&
    !isOffline &&
    !isLimitReached;

  const sendHighlight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = canSend ? 1 : 0;

    if (reduceMotion || typeof jest !== 'undefined') {
      sendHighlight.setValue(target);
      return;
    }

    sendHighlight.stopAnimation();
    const animation = Animated.spring(sendHighlight, {
      damping: 16,
      mass: 0.85,
      stiffness: 220,
      toValue: target,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [canSend, reduceMotion, sendHighlight]);

  const sendBackgroundColor = sendHighlight.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.muted, theme.colors.primary],
  });
  const sendScale = sendHighlight.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, 0.75, 1],
    outputRange: [1, 1.035, 1],
  });

  const handleSend = useCallback(async () => {
    if (!canSend) {
      return;
    }

    const outgoing = trimmedDraft;
    setDraft('');
    shouldAnimateNextReplyRef.current = true;
    triggerHaptic('primaryAction').catch(() => undefined);

    const sent = await sendJadeChatMessage(outgoing);
    if (!sent) {
      shouldAnimateNextReplyRef.current = false;
      // Give the text back rather than making them retype it.
      setDraft(outgoing);
    }
  }, [canSend, sendJadeChatMessage, trimmedDraft]);

  const handleStarterPrompt = useCallback(
    (prompt: string) => {
      setDraft(prompt);
      inputRef.current?.focus();
      triggerHaptic('optionSelected').catch(() => undefined);

      draftReveal.stopAnimation();
      if (reduceMotion || typeof jest !== 'undefined') {
        draftReveal.setValue(1);
        return;
      }

      draftReveal.setValue(0);
      Animated.timing(draftReveal, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }).start();
    },
    [draftReveal, reduceMotion],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (event.nativeEvent.contentOffset.y < LOAD_OLDER_THRESHOLD) {
        loadOlderJadeMessages().catch(() => undefined);
      }
    },
    [loadOlderJadeMessages],
  );

  const handleContentSizeChange = useCallback(() => {
    const shouldJumpToHistoryEnd =
      isOpeningHistoryRef.current && !isLoadingJadeThread;

    scrollRef.current?.scrollToEnd({ animated: !shouldJumpToHistoryEnd });

    if (!shouldJumpToHistoryEnd) {
      return;
    }

    if (historyScrollResetFrameRef.current !== null) {
      cancelAnimationFrame(historyScrollResetFrameRef.current);
    }
    historyScrollResetFrameRef.current = requestAnimationFrame(() => {
      isOpeningHistoryRef.current = false;
      historyScrollResetFrameRef.current = null;
    });
  }, [isLoadingJadeThread]);

  const handleBack = useCallback(() => {
    triggerHaptic('back').catch(() => undefined);
    onBack();
  }, [onBack]);

  const handleOpenPanel = useCallback(() => {
    triggerHaptic('bottomSheet').catch(() => undefined);
    setIsPanelVisible(true);
    loadJadeSessions({ refresh: true }).catch(() => undefined);
  }, [loadJadeSessions]);

  const renderBubble = (message: JadeThreadMessage) => {
    const isUser = message.role === 'user';
    const isStreaming = message.id === streamingMessageId;
    const body = isStreaming ? streamedText : message.text;
    const hasRichBlocks = (message.blocks || []).some(
      block => block.type !== 'text',
    );

    if (message.status === 'support_first') {
      return (
        <View
          key={message.id}
          style={[
            styles.supportBubble,
            {
              backgroundColor: hexToRgba(theme.colors.destructive, 0.08),
              borderColor: hexToRgba(theme.colors.destructive, 0.3),
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: theme.colors.foreground }]}>
            {message.text}
          </Text>
        </View>
      );
    }

    return (
      <MessageEntrance
        animate={isUser && message.id.startsWith('local-')}
        key={message.id}
        messageId={message.id}
        reduceMotion={reduceMotion}
      >
        <View
          style={[
            styles.bubbleRow,
            isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isUser
                ? {
                    backgroundColor: hexToRgba(
                      theme.colors.secondary,
                      theme.mode === 'dark' ? 0.72 : 0.9,
                    ),
                    borderColor: hexToRgba(theme.colors.border, 0.76),
                  }
                : {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
              message.failed ? { borderColor: theme.colors.destructive } : null,
              !isUser && hasRichBlocks ? styles.richBubble : null,
            ]}
          >
            {isUser ? (
              <Text
                style={[styles.bubbleText, { color: theme.colors.foreground }]}
              >
                {body}
              </Text>
            ) : (
              <JadeMessageContent
                blocks={message.blocks || []}
                displayedText={isStreaming ? streamedText : null}
                fallbackText={message.text}
                showRich={!isStreaming}
              />
            )}

            {message.failed ? (
              <HapticPressable
                accessibilityLabel="Retry sending"
                accessibilityRole="button"
                onPress={() => {
                  setDraft(message.text);
                }}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text
                  style={[
                    styles.retryText,
                    { color: theme.colors.destructive },
                  ]}
                >
                  Didn't send — tap to retry
                </Text>
              </HapticPressable>
            ) : null}

            {!isUser && message.status === 'fallback' ? (
              <HapticPressable
                accessibilityLabel="Edit and retry your message"
                accessibilityRole="button"
                onPress={() => {
                  const preceding = [...jadeMessages]
                    .reverse()
                    .find(
                      item => item.role === 'user' && item.seq < message.seq,
                    );
                  if (preceding) {
                    setDraft(preceding.text);
                    inputRef.current?.focus();
                  }
                }}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text
                  style={[styles.retryText, { color: theme.colors.primary }]}
                >
                  Edit and retry
                </Text>
              </HapticPressable>
            ) : null}
          </View>
        </View>
      </MessageEntrance>
    );
  };

  const renderThread = () => {
    if (isLoadingJadeThread) {
      return (
        <View style={styles.loadingState} testID="ask-jade-loading">
          {[0, 1, 2].map(index => (
            <ShimmerBlock
              baseColor={theme.colors.muted}
              highlightColor={theme.colors.secondary}
              key={index}
              style={[
                styles.shimmerBubble,
                index % 2 === 0 ? styles.shimmerLeft : styles.shimmerRight,
              ]}
            />
          ))}
        </View>
      );
    }

    if (jadeMessages.length === 0) {
      return (
        <View style={styles.emptyState} testID="ask-jade-empty">
          <Image source={JADE_ICON} style={styles.emptyIcon} />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={[styles.emptyTitle, { color: theme.colors.foreground }]}
          >
            Ask me anything you've been writing about.
          </Text>
          <Text
            style={[styles.emptyBody, { color: theme.colors.mutedForeground }]}
          >
            I remember the patterns your entries keep showing, so we can pick up
            wherever you left off.
          </Text>

          <View style={styles.starterRow}>
            {STARTER_PROMPTS.map(prompt => (
              <HapticPressable
                accessibilityLabel={`Use starter prompt: ${prompt}`}
                accessibilityRole="button"
                key={prompt}
                onPress={() => handleStarterPrompt(prompt)}
                style={({ pressed }) => [
                  styles.starterChip,
                  { borderColor: theme.colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.starterText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {prompt}
                </Text>
              </HapticPressable>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.thread}>
        {isLoadingOlder ? (
          <View style={styles.olderRow}>
            <JournalLoader color={theme.colors.primary} size="small" />
          </View>
        ) : null}

        {jadeMessages.map(renderBubble)}

        {isSendingJadeMessage ? (
          <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
            <View
              style={[
                styles.bubble,
                styles.typingBubble,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              testID="ask-jade-typing"
            >
              <JadeThinkingIndicator
                color={theme.colors.mutedForeground}
                reduceMotion={reduceMotion}
              />
            </View>
          </View>
        ) : null}

        {jadeThreadError ? (
          <Text
            style={[
              styles.threadError,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {jadeThreadError}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderLocked = () => (
    <View style={styles.lockedState} testID="ask-jade-locked">
      <Image source={JADE_ICON} style={styles.emptyIcon} />
      <Text style={[styles.lockedTitle, { color: theme.colors.foreground }]}>
        Ask Jade is part of Premium
      </Text>
      <Text
        style={[styles.lockedBody, { color: theme.colors.mutedForeground }]}
      >
        Jade reads the patterns across everything you've written, so the answers
        come from your own history rather than generic advice.
      </Text>
      <HapticPressable
        accessibilityLabel="Upgrade to Premium"
        accessibilityRole="button"
        onPress={onUpgrade}
        style={({ pressed }) => [
          styles.upgradeButton,
          { backgroundColor: theme.colors.primary },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.upgradeLabel,
            { color: theme.colors.primaryForeground },
          ]}
        >
          See Premium
        </Text>
      </HapticPressable>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      testID="ask-jade-safe-area"
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[styles.headerShell, { paddingHorizontal: horizontalPadding }]}
      >
        <View style={[styles.headerRow, { maxWidth: layoutMaxWidth }]}>
          <HapticPressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.headerButton,
              styles.headerCircleButton,
              {
                backgroundColor: theme.colors.secondary,
                borderColor: theme.colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <ArrowLeft color={theme.colors.foreground} size={18} />
          </HapticPressable>

          <View style={styles.headerTitleGroup}>
            <Image source={JADE_ICON} style={styles.headerIcon} />
            <Text
              style={[styles.headerTitle, { color: theme.colors.foreground }]}
            >
              Ask Jade
            </Text>
          </View>

          {isLocked ? (
            <View style={styles.headerButton} />
          ) : (
            <HapticPressable
              accessibilityLabel="Previous chats"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleOpenPanel}
              style={({ pressed }) => [
                styles.headerButton,
                styles.headerCircleButton,
                {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
              testID="ask-jade-more"
            >
              <MoreHorizontal color={theme.colors.foreground} size={20} />
            </HapticPressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardRoot}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            styles.scrollContent,
            { maxWidth: layoutMaxWidth, paddingHorizontal: horizontalPadding },
          ]}
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          ref={scrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {isLocked ? renderLocked() : renderThread()}
        </ScrollView>

        {isLocked ? null : (
          <View
            style={[
              styles.composerShell,
              {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
                paddingHorizontal: horizontalPadding,
              },
            ]}
          >
            {isOffline ? (
              <Text
                style={[styles.notice, { color: theme.colors.mutedForeground }]}
              >
                You're offline. Jade will be here when you reconnect.
              </Text>
            ) : null}

            {isLimitReached ? (
              <Text
                style={[styles.notice, { color: theme.colors.mutedForeground }]}
                testID="ask-jade-limit"
              >
                You've reached your limit with Jade for today. It resets in a
                few hours.
              </Text>
            ) : null}

            <View style={[styles.composerRow, { maxWidth: layoutMaxWidth }]}>
              <Animated.View
                style={[
                  styles.composerInputShell,
                  {
                    opacity: draftReveal,
                    transform: [
                      {
                        translateY: draftReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [6, 0],
                        }),
                      },
                    ],
                  },
                ]}
                testID="ask-jade-input-reveal"
              >
                <TextInput
                  accessibilityLabel="Message Jade"
                  editable={!isSendingJadeMessage}
                  maxLength={MESSAGE_MAX_LENGTH}
                  multiline
                  onChangeText={setDraft}
                  placeholder="Tell Jade what's on your mind"
                  placeholderTextColor={theme.colors.mutedForeground}
                  ref={inputRef}
                  style={[
                    styles.composerInput,
                    {
                      backgroundColor: theme.colors.inputBackground,
                      borderColor: theme.colors.border,
                      color: theme.colors.foreground,
                    },
                  ]}
                  testID="ask-jade-input"
                  value={draft}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.sendShell,
                  {
                    backgroundColor: sendBackgroundColor,
                    transform: [{ scale: sendScale }],
                  },
                ]}
              >
                <HapticPressable
                  accessibilityLabel="Send message"
                  accessibilityRole="button"
                  accessibilityState={{
                    busy: isSendingJadeMessage,
                    disabled: !canSend,
                  }}
                  disabled={!canSend}
                  onPress={handleSend}
                  style={styles.sendButton}
                  testID="ask-jade-send"
                >
                  <ButtonLoadingContent
                    loaderColor={theme.colors.primaryForeground}
                    loading={isSendingJadeMessage}
                  >
                    <Send
                      color={
                        canSend
                          ? theme.colors.primaryForeground
                          : theme.colors.mutedForeground
                      }
                      size={16}
                    />
                  </ButtonLoadingContent>
                </HapticPressable>
              </Animated.View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <JadeSessionsPanel
        activeSessionId={jadeSessionId}
        errorMessage={jadeSessionsError}
        hasMore={jadeSessionsHasMore}
        isLoading={isLoadingJadeSessions}
        onClose={() => setIsPanelVisible(false)}
        onDeleteSession={sessionId => {
          removeJadeSession(sessionId).catch(() => undefined);
        }}
        onLoadMore={() => {
          loadMoreJadeSessions().catch(() => undefined);
        }}
        onNewChat={() => {
          stopTypewriter();
          setStreamingMessageId(null);
          setStreamedText('');
          shouldAnimateNextReplyRef.current = false;
          isOpeningHistoryRef.current = false;
          startNewJadeChat();
          setIsPanelVisible(false);
        }}
        onRetry={() => {
          loadJadeSessions({ refresh: true }).catch(() => undefined);
        }}
        onSelectSession={sessionId => {
          stopTypewriter();
          setStreamingMessageId(null);
          setStreamedText('');
          shouldAnimateNextReplyRef.current = false;
          isOpeningHistoryRef.current = true;
          setIsPanelVisible(false);
          openJadeSession(sessionId).then(() => {
            if (useAppStore.getState().jadeSessionId !== sessionId) {
              isOpeningHistoryRef.current = false;
              return;
            }

            if (historyScrollResetFrameRef.current !== null) {
              cancelAnimationFrame(historyScrollResetFrameRef.current);
            }
            historyScrollResetFrameRef.current = requestAnimationFrame(() => {
              scrollRef.current?.scrollToEnd({ animated: false });
              isOpeningHistoryRef.current = false;
              historyScrollResetFrameRef.current = null;
            });
          });
        }}
        sessions={jadeSessions}
        reduceMotion={reduceMotion}
        visible={isPanelVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerShell: {
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 10,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 42,
    width: '100%',
  },
  headerButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerCircleButton: {
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitleGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  headerIcon: {
    height: 22,
    resizeMode: 'contain',
    width: 22,
  },
  headerTitle: {
    ...typography.heading,
  },
  keyboardRoot: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    paddingBottom: 24,
    width: '100%',
  },
  thread: {
    gap: 12,
    paddingTop: 8,
  },
  olderRow: {
    paddingVertical: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageEntrance: {
    width: '100%',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  richBubble: {
    maxWidth: '100%',
    width: '100%',
  },
  supportBubble: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  typingBubble: {
    paddingVertical: 10,
  },
  bubbleText: {
    ...typography.body,
  },
  typingText: {
    ...typography.bodySm,
  },
  thinkingContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  thinkingDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  thinkingDot: {
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  retryText: {
    ...typography.caption,
    fontWeight: '600',
  },
  threadError: {
    ...typography.caption,
    paddingTop: 4,
    textAlign: 'center',
  },
  loadingState: {
    gap: 12,
    paddingTop: 16,
  },
  shimmerBubble: {
    borderRadius: 18,
    height: 56,
    width: '70%',
  },
  shimmerLeft: {
    alignSelf: 'flex-start',
  },
  shimmerRight: {
    alignSelf: 'flex-end',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  lockedState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyIcon: {
    height: 64,
    resizeMode: 'contain',
    width: 64,
  },
  emptyTitle: {
    ...typography.subheading,
    textAlign: 'center',
    width: '100%',
  },
  emptyBody: {
    ...typography.caption,
    textAlign: 'center',
  },
  lockedTitle: {
    ...typography.title,
    textAlign: 'center',
  },
  lockedBody: {
    ...typography.bodySm,
    textAlign: 'center',
  },
  starterRow: {
    gap: 8,
    paddingTop: 12,
    width: '100%',
  },
  starterChip: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  starterText: {
    ...typography.bodySm,
  },
  upgradeButton: {
    borderRadius: 14,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  upgradeLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  composerShell: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingTop: 10,
  },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  composerInputShell: {
    flex: 1,
  },
  composerInput: {
    ...typography.body,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlignVertical: 'top',
    width: '100%',
  },
  sendShell: {
    borderRadius: 22,
  },
  sendButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  notice: {
    ...typography.caption,
    paddingBottom: 8,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});

export default AskJadeScreen;
