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

const shouldFallbackAfterEmojiAttempt = () =>
  Platform.OS === "ios" && Platform.isPad;

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

  useEffect(() => {
    setShowFallback(false);

    if (!shouldFallbackAfterEmojiAttempt()) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setShowFallback(true);
    }, fallbackDelayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [emoji, fallbackDelayMs]);

  if (showFallback) {
    return (
      <View style={[styles.fallbackIconWrap, fallbackStyle]}>
        <FallbackIcon size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  return <Text style={emojiStyle}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  fallbackIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
