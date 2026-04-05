import { Pressable, StyleSheet, Text, View } from "react-native";
import { Star, Tag } from "lucide-react-native";
import { useAppStore } from "../store/appStore";
import { useTheme } from "../theme/provider";
import {
  formatDate,
  getEntryEmoji,
  getEntryTitle,
  getEntryTone,
  getFilteredTags,
  type JournalEntryCardSource,
} from "../utils/journalEntryCard";

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

function getToneStyle(theme: ReturnType<typeof useTheme>, tone: ReturnType<typeof getEntryTone>) {
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
  if (entry.type === "quick-thought") {
    return "Quick Thought";
  }

  if (entry.type === "mood-checkin") {
    return "Mood Check-In";
  }

  return "Journal Entry";
}

type JournalEntryCardProps = {
  entry: JournalEntryCardSource;
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavoriteUpdating?: boolean;
  previewLines?: number;
};

export default function JournalEntryCard({
  entry,
  onPress,
  onFavoritePress,
  isFavoriteUpdating = false,
  previewLines = 2,
}: JournalEntryCardProps) {
  const theme = useTheme();
  const hideJournalPreviews = useAppStore(state => state.hideJournalPreviews);
  const title = hideJournalPreviews ? getMaskedEntryTitle(entry) : getEntryTitle(entry);
  const emoji = getEntryEmoji(entry);
  const tone = getEntryTone(entry);
  const toneStyle = getToneStyle(theme, tone);
  const displayTags = hideJournalPreviews ? [] : getFilteredTags(entry.tags);
  const previewText = hideJournalPreviews
    ? "Preview hidden. Open the entry to read it."
    : entry.content;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `Open entry ${title}` : undefined}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: entry.isFavorite
            ? hexToRgba(theme.colors.primary, 0.18)
            : theme.colors.border,
          shadowColor: theme.colors.foreground,
        },
        onPress ? styles.cardPressable : null,
      ]}
    >
      <View style={styles.metaRow}>
        <View style={styles.headerRow}>
            <View style={styles.emojiDateRow}>
              <Text style={styles.emoji}>{emoji}</Text>
              <Text style={[styles.date, { color: theme.colors.mutedForeground }]}>
                {formatDate(entry.createdAt)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={entry.isFavorite ? "Remove favorite" : "Add favorite"}
              disabled={!onFavoritePress || isFavoriteUpdating}
              hitSlop={8}
              onPress={event => {
                event.stopPropagation();
                onFavoritePress?.();
              }}
              style={({ pressed }) => [
                styles.headerActions,
                (pressed || isFavoriteUpdating) && styles.favoritePressed,
              ]}
            >
              <Star
                size={18}
                fill={entry.isFavorite ? theme.colors.warning : "transparent"}
                color={entry.isFavorite ? theme.colors.warning : theme.colors.mutedForeground}
              />
            </Pressable>
        </View>
          <Text
            style={[styles.title, { color: theme.colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </Text>
      </View>

      <Text
        style={[styles.content, { color: theme.colors.mutedForeground }]}
        numberOfLines={previewLines}
      >
        {previewText}
      </Text>

      {displayTags.length ? (
        <View style={styles.tagRow}>
          <Tag size={11} color={theme.colors.mutedForeground} />
          {displayTags.slice(0, 3).map(tag => (
            <View
              key={tag}
              style={[
                styles.tagPill,
                {
                  backgroundColor: toneStyle.chipBackgroundColor,
                },
              ]}
            >
              <Text style={[styles.tagText, { color: toneStyle.chipForegroundColor }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowOpacity: 0.04,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 14,
    elevation: 1,
  },
  cardPressable: {
    opacity: 0.98,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  emojiDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emoji: {
    fontSize: 18,
  },
  headerActions: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  favoritePressed: {
    opacity: 0.65,
  },
  metaRow: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
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
});
