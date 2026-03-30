import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowLeft,
  Edit2,
  Loader2,
  Star,
  Tag,
  Trash2,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  deleteJournalEntry,
  getJournalEntry,
  toggleJournalFavorite,
} from "../../services/journalService";
import { useAppStore } from "../../store/appStore";
import type { JournalEntry } from "../../models/journalModels";
import { useTheme } from "../../theme/provider";

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getEntryTypeLabel(type: string) {
  if (type === "quick-thought") {
    return "Quick Thought";
  }

  if (type === "mood-checkin") {
    return "Mood check-in";
  }

  return "Journal entry";
}

function JournalTags({ tags }: { tags: string[] }) {
  const theme = useTheme();

  if (!tags.length) {
    return null;
  }

  return (
    <View style={styles.tagSection}>
      <View style={styles.tagHeader}>
        <Tag size={14} color={theme.colors.mutedForeground} />
        <Text style={[styles.tagSectionLabel, { color: theme.colors.foreground }]}>
          Tags
        </Text>
      </View>
      <View style={styles.tagRow}>
        {tags.map(tag => (
          <View
            key={tag}
            style={[
              styles.tagChip,
              {
                backgroundColor: theme.colors.secondary,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.tagChipText, { color: theme.colors.secondaryForeground }]}>
              {tag}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EntryDetailScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const entryId = useAppStore(state => state.selectedJournalEntryId);
  const entries = useAppStore(state => state.recentJournalEntries);
  const closeJournalEntry = useAppStore(state => state.closeJournalEntry);
  const openJournalEditor = useAppStore(state => state.openJournalEditor);
  const removeRecentJournalEntry = useAppStore(
    state => state.removeRecentJournalEntry
  );
  const updateRecentJournalEntry = useAppStore(
    state => state.updateRecentJournalEntry
  );
  const [hydratedEntry, setHydratedEntry] = useState<JournalEntry | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;

  const entry = useMemo(
    () =>
      hydratedEntry ||
      entries.find(current => current._id === entryId) ||
      null,
    [entryId, entries, hydratedEntry]
  );

  useEffect(() => {
    if (!entryId) {
      setHydratedEntry(null);
      return;
    }

    let isActive = true;

    setIsRefreshing(true);

    getJournalEntry(entryId)
      .then(fetchedEntry => {
        if (!isActive) {
          return;
        }

        setHydratedEntry(fetchedEntry);
        updateRecentJournalEntry(fetchedEntry);
      })
      .catch(() => {
        // Keep the locally cached entry in place if the backend refresh fails.
      })
      .finally(() => {
        if (isActive) {
          setIsRefreshing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [entryId, updateRecentJournalEntry]);

  const handleToggleFavorite = async () => {
    if (!entry || isTogglingFavorite) {
      return;
    }

    setIsTogglingFavorite(true);

    try {
      const updatedEntry = await toggleJournalFavorite({
        journalId: entry._id,
        isFavorite: !entry.isFavorite,
      });

      setHydratedEntry(updatedEntry);
      updateRecentJournalEntry(updatedEntry);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleDelete = () => {
    if (!entry || isDeleting) {
      return;
    }

    Alert.alert(
      "Delete entry?",
      "This entry will be removed from your journal history.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);

            try {
              await deleteJournalEntry(entry._id);
              removeRecentJournalEntry(entry._id);
              closeJournalEntry();
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!entryId) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.emptyState, { paddingHorizontal: horizontalPadding }]}>
          <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
            Entry not found
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.mutedForeground }]}>
            Choose an entry from Home or Calendar to view it here.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
            onPress={closeJournalEntry}
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.backButtonText, { color: theme.colors.foreground }]}>
              Go home
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!entry && isRefreshing) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.emptyState, { paddingHorizontal: horizontalPadding }]}>
          <Loader2 size={22} color={theme.colors.primary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
            Loading entry
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.emptyState, { paddingHorizontal: horizontalPadding }]}>
          <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
            Entry unavailable
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.mutedForeground }]}>
            The journal item could not be loaded.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={closeJournalEntry}
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.backButtonText, { color: theme.colors.foreground }]}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const favoriteLabel = entry.isFavorite ? "Remove favorite" : "Add favorite";

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
        <View style={[styles.shell, { maxWidth: layoutMaxWidth }]}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={closeJournalEntry}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={18} color={theme.colors.foreground} />
            </Pressable>

            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favoriteLabel}
                onPress={handleToggleFavorite}
                disabled={isTogglingFavorite}
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    borderColor: entry.isFavorite
                      ? theme.colors.primary
                      : theme.colors.border,
                    backgroundColor: entry.isFavorite
                      ? `${theme.colors.primary}14`
                      : theme.colors.card,
                  },
                  pressed && !isTogglingFavorite && styles.pressed,
                ]}
              >
                {isTogglingFavorite ? (
                  <Loader2 size={16} color={theme.colors.primary} />
                ) : (
                  <Star
                    size={16}
                    fill={entry.isFavorite ? theme.colors.warning : "transparent"}
                    color={entry.isFavorite ? theme.colors.warning : theme.colors.foreground}
                  />
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit entry"
                onPress={() => openJournalEditor(entry._id)}
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Edit2 size={16} color={theme.colors.foreground} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
                onPress={handleDelete}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                  pressed && !isDeleting && styles.pressed,
                ]}
              >
                {isDeleting ? (
                  <Loader2 size={16} color={theme.colors.destructive} />
                ) : (
                  <Trash2 size={16} color={theme.colors.destructive} />
                )}
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.metaLabel, { color: theme.colors.mutedForeground }]}>
                {getEntryTypeLabel(entry.type)}
              </Text>
              <Text style={[styles.dateText, { color: theme.colors.mutedForeground }]}>
                {formatEntryDate(entry.createdAt)}
              </Text>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {entry.title}
              </Text>
              <Text style={[styles.contentText, { color: theme.colors.foreground }]}>
                {entry.content}
              </Text>

              <JournalTags tags={entry.tags} />

              <View style={styles.footerRow}>
                <Text style={[styles.footerText, { color: theme.colors.mutedForeground }]}>
                  Updated {formatEntryDate(entry.updatedAt)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
  },
  shell: {
    flex: 1,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  metaLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 23,
  },
  tagSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  tagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  tagSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footerRow: {
    marginTop: 20,
    alignItems: "flex-start",
  },
  footerText: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  backButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
