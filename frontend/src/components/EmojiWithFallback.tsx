import { useEffect, useState, type ComponentType } from "react";
import {
  Platform,
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
};

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

export default function EmojiWithFallback({
  emoji,
  fallbackIcon,
  fallbackIconColor,
  fallbackIconSize = 20,
  emojiStyle,
  fallbackStyle,
  fallbackDelayMs = 160,
}: EmojiWithFallbackProps) {
  const [showFallback, setShowFallback] = useState(false);
  const FallbackIcon = fallbackIcon;
  const fallbackAfterEmojiAttempt = shouldFallbackAfterEmojiAttempt();

  useEffect(() => {
    setShowFallback(false);

    if (!fallbackAfterEmojiAttempt) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setShowFallback(true);
    }, fallbackDelayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [emoji, fallbackAfterEmojiAttempt, fallbackDelayMs]);

  if (showFallback) {
    return (
      <View style={[styles.fallbackIconWrap, fallbackStyle]}>
        <FallbackIcon size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  return (
    <Text style={emojiStyle}>
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
