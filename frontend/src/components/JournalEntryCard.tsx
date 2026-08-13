import HapticPressable from './HapticPressable';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  Text,
} from "../infrastructure/reactNative";
import { useCallback, useEffect, useRef, useState } from "react";
import { Star, Tag, Trash2 } from "lucide-react-native";
import { triggerHaptic } from "../services/hapticsService";
import { useAppStore } from "../store/appStore";
import { useTheme } from "../theme/provider";
import ButtonLoadingContent from "./ButtonLoadingContent";
import {
  formatDate,
  formatEntryTagLabel,
  getEntryDisplayTags,
  getEntryTitle,
  getEntryTone,
  getEntryVisualKey,
  type JournalEntryCardSource,
  type JournalEntryVisualKey,
} from "../utils/journalEntryCard";

const ACTION_TRAY_WIDTH = 168;
const ACTION_WIDTH = ACTION_TRAY_WIDTH / 2;
const CARD_CORNER_RADIUS = 20;
const SWIPE_CLAIM_DISTANCE = 8;
const SWIPE_OPEN_DISTANCE = ACTION_TRAY_WIDTH * 0.4;
const DOUBLE_TAP_WINDOW_MS = 300;
const GUIDED_ENTRY_ICON = require("../assets/png/entry/icons8-yoga-48.png");
const OPEN_ENDED_ENTRY_ICON = require("../assets/png/entry/icons8-journal-100.png");
const QUICK_THOUGHT_ENTRY_ICON = require("../assets/png/home/quill-pen.png");

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

function getToneStyle(
  theme: ReturnType<typeof useTheme>,
  tone: ReturnType<typeof getEntryTone>
) {
  if (tone === "warm") {
    return {
      backgroundColor: hexToRgba(theme.colors.success, 0.12),
      foregroundColor: theme.colors.success,
      chipBackgroundColor: hexToRgba(theme.colors.success, 0.08),
      chipForegroundColor: theme.colors.success,
    };
  }

  if (tone === "challenge") {
    return {
      backgroundColor: hexToRgba(theme.colors.warning, 0.16),
      foregroundColor: theme.colors.warning,
      chipBackgroundColor: hexToRgba(theme.colors.warning, 0.08),
      chipForegroundColor: theme.colors.warning,
    };
  }

  if (tone === "supportive") {
    return {
      backgroundColor: hexToRgba(theme.colors.info, 0.14),
      foregroundColor: theme.colors.info,
      chipBackgroundColor: hexToRgba(theme.colors.info, 0.08),
      chipForegroundColor: theme.colors.info,
    };
  }

  return {
    backgroundColor: hexToRgba(theme.colors.primary, 0.1),
    foregroundColor: theme.colors.primary,
    chipBackgroundColor: hexToRgba(theme.colors.primary, 0.08),
    chipForegroundColor: theme.colors.primary,
  };
}

function getMaskedEntryTitle(entry: JournalEntryCardSource) {
  return getEntryVisualKey(entry) === "quick-thought"
    ? "Quick Thought"
    : "Journal Entry";
}

function EntryTypeIcon({ visualKey }: { visualKey: JournalEntryVisualKey }) {
  const theme = useTheme();

  if (visualKey === "guided") {
    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={GUIDED_ENTRY_ICON}
        style={styles.entryArtwork}
        testID="entry-type-icon-guided"
      />
    );
  }

  if (visualKey === "open-ended") {
    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={OPEN_ENDED_ENTRY_ICON}
        style={styles.entryArtwork}
        testID="entry-type-icon-open-ended"
      />
    );
  }

  return (
    <View
      style={[
        styles.quickThoughtIcon,
        { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
      ]}
      testID="entry-type-icon-quick-thought"
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={QUICK_THOUGHT_ENTRY_ICON}
        style={styles.quickThoughtArtwork}
      />
    </View>
  );
}

type JournalEntryCardProps = {
  entry: JournalEntryCardSource;
  onPress?: () => void;
  onFavoritePress?: (nextFavorite: boolean) => void | Promise<void>;
  onDeletePress?: () => void;
  isFavoriteUpdating?: boolean;
  isDeleting?: boolean;
  actionsDisabled?: boolean;
  actionsOpen?: boolean;
  onActionsOpenChange?: (open: boolean) => void;
  onHorizontalSwipeClaim?: () => void;
  enableEntryActions?: boolean;
  previewLines?: number;
};

export default function JournalEntryCard({
  entry,
  onPress,
  onFavoritePress,
  onDeletePress,
  isFavoriteUpdating = false,
  isDeleting = false,
  actionsDisabled = false,
  actionsOpen,
  onActionsOpenChange,
  onHorizontalSwipeClaim,
  enableEntryActions = false,
  previewLines = 2,
}: JournalEntryCardProps) {
  const theme = useTheme();
  const hideJournalPreviews = useAppStore(state => state.hideJournalPreviews);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(Boolean(actionsOpen));
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [forceFavoriteVisual, setForceFavoriteVisual] = useState(false);
  const [cardLayout, setCardLayout] = useState({ width: 0, height: 0 });
  const translateX = useRef(new Animated.Value(actionsOpen ? -ACTION_TRAY_WIDTH : 0)).current;
  const celebrationProgress = useRef(new Animated.Value(0)).current;
  const favoritePulse = useRef(new Animated.Value(1)).current;
  const currentTranslateRef = useRef(actionsOpen ? -ACTION_TRAY_WIDTH : 0);
  const panStartRef = useRef(0);
  const pendingCardPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favoriteRequestFailedRef = useRef(false);
  const drawerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const celebrationAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const title = hideJournalPreviews
    ? getMaskedEntryTitle(entry)
    : getEntryTitle(entry);
  const visualKey = getEntryVisualKey(entry);
  const tone = getEntryTone(entry);
  const toneStyle = getToneStyle(theme, tone);
  const displayTags = hideJournalPreviews ? [] : getEntryDisplayTags(entry);
  const previewText = hideJournalPreviews
    ? "Preview hidden. Open the entry to read it."
    : entry.content;
  const canRevealActions = Boolean(
    enableEntryActions && onFavoritePress && onDeletePress && !actionsDisabled
  );
  const canDoubleTapFavorite = Boolean(
    enableEntryActions &&
      onFavoritePress &&
      !actionsDisabled &&
      !isFavoriteUpdating &&
      !isDeleting
  );
  const favoriteVisualActive = Boolean(entry.isFavorite || forceFavoriteVisual);

  const settleDrawer = useCallback(
    (open: boolean, notify = true) => {
      const nextValue = open ? -ACTION_TRAY_WIDTH : 0;
      drawerAnimationRef.current?.stop();
      currentTranslateRef.current = nextValue;

      if (open) {
        setDrawerVisible(true);
      }

      if (notify) {
        onActionsOpenChange?.(open);
      }

      if (reduceMotion) {
        translateX.setValue(nextValue);
        if (!open) {
          setDrawerVisible(false);
        }
        return;
      }

      drawerAnimationRef.current = Animated.spring(translateX, {
        toValue: nextValue,
        speed: 24,
        bounciness: 0,
        useNativeDriver: true,
      });
      drawerAnimationRef.current.start(({ finished }) => {
        if (finished && !open) {
          setDrawerVisible(false);
        }
      });
    },
    [onActionsOpenChange, reduceMotion, translateX]
  );

  const runFavoritePulse = useCallback(() => {
    if (reduceMotion) {
      favoritePulse.setValue(1);
      return;
    }

    pulseAnimationRef.current?.stop();
    favoritePulse.setValue(1);
    pulseAnimationRef.current = Animated.sequence([
      Animated.timing(favoritePulse, {
        toValue: 1.2,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(favoritePulse, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    pulseAnimationRef.current.start();
  }, [favoritePulse, reduceMotion]);

  const clearPendingCardPress = useCallback(() => {
    if (pendingCardPressTimerRef.current) {
      clearTimeout(pendingCardPressTimerRef.current);
      pendingCardPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (mounted && enabled) {
          setReduceMotion(true);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof actionsOpen === "boolean") {
      settleDrawer(actionsOpen, false);
    }
  }, [actionsOpen, settleDrawer]);

  useEffect(() => {
    if (entry.isFavorite || (!isCelebrating && !isFavoriteUpdating)) {
      setForceFavoriteVisual(false);
    }
  }, [entry.isFavorite, isCelebrating, isFavoriteUpdating]);

  useEffect(() => {
    return () => {
      clearPendingCardPress();
      drawerAnimationRef.current?.stop();
      celebrationAnimationRef.current?.stop();
      pulseAnimationRef.current?.stop();
    };
  }, [clearPendingCardPress]);

  const requestFavorite = (nextFavorite: boolean) => {
    try {
      return Promise.resolve(onFavoritePress?.(nextFavorite));
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const handleFavoriteChange = (nextFavorite: boolean) => {
    clearPendingCardPress();
    triggerHaptic("primaryAction").catch(() => undefined);
    settleDrawer(false);
    requestFavorite(nextFavorite).catch(() => undefined);
  };

  const handleDoubleTapFavorite = () => {
    if (!canDoubleTapFavorite) {
      return;
    }

    triggerHaptic("primaryAction").catch(() => undefined);
    settleDrawer(false);

    if (entry.isFavorite) {
      runFavoritePulse();
      return;
    }

    favoriteRequestFailedRef.current = false;
    setForceFavoriteVisual(reduceMotion);
    requestFavorite(true).catch(() => {
      favoriteRequestFailedRef.current = true;
      setForceFavoriteVisual(false);
    });

    if (reduceMotion) {
      return;
    }

    celebrationAnimationRef.current?.stop();
    celebrationProgress.setValue(0);
    setIsCelebrating(true);
    celebrationAnimationRef.current = Animated.sequence([
      Animated.timing(celebrationProgress, {
        toValue: 0.32,
        duration: 150,
        easing: Easing.out(Easing.back(1.35)),
        useNativeDriver: true,
      }),
      Animated.timing(celebrationProgress, {
        toValue: 1,
        duration: 300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    celebrationAnimationRef.current.start(({ finished }) => {
      setIsCelebrating(false);
      if (finished && !favoriteRequestFailedRef.current) {
        setForceFavoriteVisual(true);
        runFavoritePulse();
      }
    });
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      canRevealActions &&
      Math.abs(gesture.dx) > SWIPE_CLAIM_DISTANCE &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderGrant: () => {
      clearPendingCardPress();
      drawerAnimationRef.current?.stop();
      panStartRef.current = currentTranslateRef.current;
      setDrawerVisible(true);
      onHorizontalSwipeClaim?.();
    },
    onPanResponderMove: (_event, gesture) => {
      const nextValue = Math.max(
        -ACTION_TRAY_WIDTH,
        Math.min(0, panStartRef.current + gesture.dx)
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
        triggerHaptic("optionSelected").catch(() => undefined);
      }
      settleDrawer(shouldOpen);
    },
    onPanResponderTerminate: () => {
      settleDrawer(false);
    },
    onPanResponderTerminationRequest: () => false,
  });

  const handleCardPress = () => {
    if (currentTranslateRef.current < 0) {
      clearPendingCardPress();
      settleDrawer(false);
      return;
    }

    if (!onPress) {
      return;
    }

    if (!canDoubleTapFavorite) {
      triggerHaptic("screenTransition").catch(() => undefined);
      onPress();
      return;
    }

    if (pendingCardPressTimerRef.current) {
      clearPendingCardPress();
      handleDoubleTapFavorite();
      return;
    }

    pendingCardPressTimerRef.current = setTimeout(() => {
      pendingCardPressTimerRef.current = null;
      triggerHaptic("screenTransition").catch(() => undefined);
      onPress();
    }, DOUBLE_TAP_WINDOW_MS);
  };

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCardLayout(current =>
      current.width === width && current.height === height
        ? current
        : { width, height }
    );
  };

  const favoriteTranslateX = Math.max(cardLayout.width / 2 - 30, 0);
  const favoriteTranslateY = Math.min(30 - cardLayout.height / 2, 0);

  return (
    <View style={styles.swipeShell} testID="journal-entry-card-shell">
      <View
        accessible={false}
        pointerEvents="none"
        style={[styles.actionTraySeam, { backgroundColor: theme.colors.warning }]}
        testID="journal-entry-action-seam"
      />
      <View
        accessibilityElementsHidden={!drawerVisible}
        importantForAccessibility={drawerVisible ? "yes" : "no-hide-descendants"}
        pointerEvents={drawerVisible ? "auto" : "none"}
        style={styles.actionsTray}
        testID="journal-entry-actions"
      >
        <HapticPressable
          accessibilityLabel={entry.isFavorite ? "Unfavorite entry" : "Favorite entry"}
          accessibilityRole="button"
          accessibilityState={{
            busy: isFavoriteUpdating,
            disabled: actionsDisabled || isFavoriteUpdating || isDeleting,
          }}
          disabled={actionsDisabled || isFavoriteUpdating || isDeleting}
          onPress={() => handleFavoriteChange(!entry.isFavorite)}
          style={({ pressed }) => [
            styles.trayAction,
            { backgroundColor: theme.colors.warning },
            pressed && styles.actionPressed,
          ]}
        >
          <ButtonLoadingContent
            loaderColor={theme.colors.warningForeground}
            loading={isFavoriteUpdating}
            style={styles.actionLoadingContent}
          >
            <View style={styles.actionContent}>
              <Star
                color={theme.colors.warningForeground}
                fill={entry.isFavorite ? theme.colors.warningForeground : "transparent"}
                size={20}
              />
              <Text style={[styles.actionLabel, { color: theme.colors.warningForeground }]}>
                {entry.isFavorite ? "Unfavorite" : "Favorite"}
              </Text>
            </View>
          </ButtonLoadingContent>
        </HapticPressable>
        <HapticPressable
          accessibilityLabel="Delete entry"
          accessibilityRole="button"
          accessibilityState={{
            busy: isDeleting,
            disabled: actionsDisabled || isFavoriteUpdating || isDeleting,
          }}
          disabled={actionsDisabled || isFavoriteUpdating || isDeleting}
          onPress={() => {
            triggerHaptic("secondaryAction").catch(() => undefined);
            settleDrawer(false);
            onDeletePress?.();
          }}
          style={({ pressed }) => [
            styles.trayAction,
            { backgroundColor: theme.colors.destructive },
            pressed && styles.actionPressed,
          ]}
        >
          <ButtonLoadingContent
            loaderColor={theme.colors.destructiveForeground}
            loading={isDeleting}
            style={styles.actionLoadingContent}
          >
            <View style={styles.actionContent}>
              <Trash2 color={theme.colors.destructiveForeground} size={20} />
              <Text
                style={[
                  styles.actionLabel,
                  { color: theme.colors.destructiveForeground },
                ]}
              >
                Delete
              </Text>
            </View>
          </ButtonLoadingContent>
        </HapticPressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        onLayout={handleCardLayout}
        style={[
          styles.cardSurface,
          {
            backgroundColor: theme.colors.card,
            borderColor: entry.isFavorite
              ? hexToRgba(theme.colors.primary, 0.18)
              : theme.colors.border,
            shadowColor: theme.colors.foreground,
            transform: [{ translateX }],
          },
        ]}
      >
        <HapticPressable
          accessibilityHint={
            enableEntryActions
              ? "Swipe left for favorite and delete actions. Double tap to favorite."
              : undefined
          }
          accessibilityLabel={onPress ? `Open entry ${title}` : undefined}
          accessibilityRole={onPress ? "button" : undefined}
          disabled={isDeleting}
          onPress={handleCardPress}
          style={({ pressed }) => [
            styles.cardContent,
            pressed && onPress ? styles.cardPressed : null,
          ]}
        >
          <View style={styles.metaRow}>
            <View style={styles.headerRow}>
              <View style={styles.visualDateRow}>
                <EntryTypeIcon visualKey={visualKey} />
                <Text style={[styles.date, { color: theme.colors.mutedForeground }]}>
                  {formatDate(entry.createdAt)}
                </Text>
              </View>
              <HapticPressable
                accessibilityLabel={entry.isFavorite ? "Remove favorite" : "Add favorite"}
                accessibilityRole="button"
                accessibilityState={{
                  busy: isFavoriteUpdating,
                  disabled:
                    !onFavoritePress ||
                    actionsDisabled ||
                    isFavoriteUpdating ||
                    isDeleting,
                }}
                disabled={
                  !onFavoritePress ||
                  actionsDisabled ||
                  isFavoriteUpdating ||
                  isDeleting
                }
                hitSlop={8}
                onPress={event => {
                  event.stopPropagation();
                  handleFavoriteChange(!entry.isFavorite);
                }}
                style={({ pressed }) => [
                  styles.headerActions,
                  (pressed || isFavoriteUpdating) && styles.favoritePressed,
                ]}
              >
                <ButtonLoadingContent
                  loaderColor={theme.colors.warning}
                  loading={isFavoriteUpdating}
                  style={styles.favoriteLoadingContent}
                >
                  <Animated.View style={{ transform: [{ scale: favoritePulse }] }}>
                    <Star
                      color={
                        favoriteVisualActive
                          ? theme.colors.warning
                          : theme.colors.mutedForeground
                      }
                      fill={favoriteVisualActive ? theme.colors.warning : "transparent"}
                      size={18}
                    />
                  </Animated.View>
                </ButtonLoadingContent>
              </HapticPressable>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: theme.colors.foreground }]}
            >
              {title}
            </Text>
          </View>

          <Text
            numberOfLines={previewLines}
            style={[styles.content, { color: theme.colors.mutedForeground }]}
          >
            {previewText}
          </Text>

          {displayTags.length ? (
            <View style={styles.tagRow}>
              <Tag color={theme.colors.mutedForeground} size={11} />
              {displayTags.slice(0, 3).map(tag => (
                <View
                  key={tag}
                  style={[
                    styles.tagPill,
                    { backgroundColor: toneStyle.chipBackgroundColor },
                  ]}
                >
                  <Text style={[styles.tagText, { color: toneStyle.chipForegroundColor }]}>
                    {formatEntryTagLabel(tag)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </HapticPressable>

        {isCelebrating ? (
          <Animated.View
            accessibilityElementsHidden
            pointerEvents="none"
            style={[
              styles.celebrationStar,
              {
                opacity: celebrationProgress.interpolate({
                  inputRange: [0, 0.08, 0.82, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: celebrationProgress.interpolate({
                      inputRange: [0, 0.32, 1],
                      outputRange: [0, 0, favoriteTranslateX],
                    }),
                  },
                  {
                    translateY: celebrationProgress.interpolate({
                      inputRange: [0, 0.32, 1],
                      outputRange: [0, 0, favoriteTranslateY],
                    }),
                  },
                  {
                    scale: celebrationProgress.interpolate({
                      inputRange: [0, 0.32, 1],
                      outputRange: [0.25, 1, 0.25],
                    }),
                  },
                ],
              },
            ]}
            testID="favorite-celebration-star"
          >
            <Star
              color={theme.colors.warning}
              fill={theme.colors.warning}
              size={72}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeShell: {
    borderRadius: CARD_CORNER_RADIUS,
    overflow: "hidden",
  },
  actionTraySeam: {
    bottom: 0,
    position: "absolute",
    right: ACTION_TRAY_WIDTH,
    top: 0,
    width: CARD_CORNER_RADIUS,
  },
  actionsTray: {
    bottom: 0,
    flexDirection: "row",
    position: "absolute",
    right: 0,
    top: 0,
    width: ACTION_TRAY_WIDTH,
  },
  trayAction: {
    alignItems: "center",
    justifyContent: "center",
    width: ACTION_WIDTH,
  },
  actionContent: {
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  actionLoadingContent: {
    minHeight: 48,
    width: ACTION_WIDTH,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  actionPressed: {
    opacity: 0.82,
  },
  cardSurface: {
    borderRadius: CARD_CORNER_RADIUS,
    borderWidth: 1,
    elevation: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  cardContent: {
    gap: 10,
    padding: 16,
  },
  cardPressed: {
    opacity: 0.98,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  visualDateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  entryArtwork: {
    height: 24,
    width: 24,
  },
  quickThoughtIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  quickThoughtArtwork: {
    height: 15,
    width: 15,
  },
  headerActions: {
    alignItems: "center",
    flexShrink: 0,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  favoriteLoadingContent: {
    height: 28,
    width: 28,
  },
  favoritePressed: {
    opacity: 0.65,
  },
  metaRow: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    lineHeight: 16,
  },
  content: {
    fontSize: 12,
    lineHeight: 18,
  },
  tagRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  tagPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
  },
  celebrationStar: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
