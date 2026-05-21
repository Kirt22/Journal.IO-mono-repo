import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Dimensions,
  Platform,
  PixelRatio,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

type EmojiWithFallbackProps = {
  emoji: string;
  fallbackIcon: ComponentType<{
    size?: number;
    color?: string;
  }>;
  fallbackIconColor: string;
  fallbackIconSize?: number;
  emojiStyle?: StyleProp<TextStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  fallbackDelayMs?: number;
  debugLabel?: string;
};

const EMOJI_DEBUG_PREFIX = "[EmojiDebug]";

const shouldLogEmojiDebug = () => __DEV__;

const getIosVersionString = () => {
  if (Platform.OS !== "ios") {
    return null;
  }

  const constantsVersion = Platform.constants?.osVersion;

  if (typeof constantsVersion === "string") {
    return constantsVersion;
  }

  return typeof Platform.Version === "string"
    ? Platform.Version
    : String(Platform.Version);
};

const getEmojiFallbackReason = () => {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (Platform.isPad) {
    return "ios-ipad-fallback";
  }

  const iosVersion = getIosVersionString();

  if (__DEV__ && iosVersion?.startsWith("26.3")) {
    return "ios-26.3-debug-emoji-font-runtime";
  }

  return null;
};

const shouldFallbackAfterEmojiAttempt = () =>
  Boolean(getEmojiFallbackReason());

const getEmojiCodePoints = (emoji: string) =>
  Array.from(emoji)
    .map(character => character.codePointAt(0)?.toString(16))
    .filter(Boolean);

const getPlatformDiagnostics = () => ({
  os: Platform.OS,
  version: Platform.Version,
  isPad: Platform.OS === "ios" ? Platform.isPad : false,
  isTV: Platform.isTV,
  constants: Platform.constants,
  window: Dimensions.get("window"),
  screen: Dimensions.get("screen"),
  fontScale: PixelRatio.getFontScale(),
  pixelRatio: PixelRatio.get(),
});

const logEmojiDebug = (event: string, data?: Record<string, unknown>) => {
  if (!shouldLogEmojiDebug()) {
    return;
  }

  console.info(`${EMOJI_DEBUG_PREFIX} ${event}`, data ?? {});
};

export default function EmojiWithFallback({
  emoji,
  fallbackIcon,
  fallbackIconColor,
  fallbackIconSize = 20,
  emojiStyle,
  fallbackStyle,
  fallbackDelayMs = 160,
  debugLabel,
}: EmojiWithFallbackProps) {
  const [showFallback, setShowFallback] = useState(false);
  const FallbackIcon = fallbackIcon;
  const renderCountRef = useRef(0);
  const flattenedEmojiStyle = StyleSheet.flatten(emojiStyle);
  const flattenedFallbackStyle = StyleSheet.flatten(fallbackStyle);
  const fallbackAfterEmojiAttempt = shouldFallbackAfterEmojiAttempt();
  const fallbackReason = getEmojiFallbackReason();
  const label = debugLabel || emoji;

  renderCountRef.current += 1;

  logEmojiDebug("render", {
    label,
    emoji,
    codePoints: getEmojiCodePoints(emoji),
    renderCount: renderCountRef.current,
    showFallback,
    fallbackAfterEmojiAttempt,
    fallbackReason,
    fallbackDelayMs,
    fallbackIconName: FallbackIcon.displayName || FallbackIcon.name || "UnknownIcon",
    fallbackIconSize,
    fallbackIconColor,
    emojiStyle: flattenedEmojiStyle,
    fallbackStyle: flattenedFallbackStyle,
    platform: getPlatformDiagnostics(),
  });

  useEffect(() => {
    setShowFallback(false);

    logEmojiDebug("emoji attempt started", {
      label,
      emoji,
      codePoints: getEmojiCodePoints(emoji),
      fallbackAfterEmojiAttempt,
      fallbackReason,
      fallbackDelayMs,
      platform: getPlatformDiagnostics(),
    });

    if (!fallbackAfterEmojiAttempt) {
      logEmojiDebug("fallback timer skipped", {
        label,
        reason: fallbackReason || "platform does not require delayed fallback",
      });
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      logEmojiDebug("fallback timer fired", {
        label,
        emoji,
        fallbackDelayMs,
        fallbackReason,
      });
      setShowFallback(true);
    }, fallbackDelayMs);

    return () => {
      logEmojiDebug("fallback timer cleared", {
        label,
        emoji,
      });
      clearTimeout(timeoutId);
    };
  }, [emoji, fallbackAfterEmojiAttempt, fallbackDelayMs, fallbackReason, label]);

  if (showFallback) {
    return (
      <View
        onLayout={event => {
          logEmojiDebug("fallback layout", {
            label,
            emoji,
            layout: event.nativeEvent.layout,
          });
        }}
        style={[styles.fallbackIconWrap, fallbackStyle]}
      >
        <FallbackIcon size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  return (
    <Text
      onLayout={event => {
        logEmojiDebug("emoji text layout", {
          label,
          emoji,
          codePoints: getEmojiCodePoints(emoji),
          layout: event.nativeEvent.layout,
          style: flattenedEmojiStyle,
        });
      }}
      onTextLayout={event => {
        logEmojiDebug("emoji text lines", {
          label,
          emoji,
          lineCount: event.nativeEvent.lines.length,
          lines: event.nativeEvent.lines.map(line => ({
            text: line.text,
            width: line.width,
            height: line.height,
            ascender: line.ascender,
            descender: line.descender,
            capHeight: line.capHeight,
            xHeight: line.xHeight,
          })),
        });
      }}
      style={emojiStyle}
    >
      {emoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  fallbackIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
