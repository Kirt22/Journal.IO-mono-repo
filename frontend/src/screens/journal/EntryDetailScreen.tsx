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
  Heart,
  Loader2,
  Star,
  Tag,
  Trash2,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, {
  BOTTOM_NAV_CONTENT_PADDING,
  type BottomNavKey,
} from "../../components/BottomNav";
import JournalPromptCard from "../../components/JournalPromptCard";
import {
  deleteJournalEntry,
  getJournalEntry,
  toggleJournalFavorite,
} from "../../services/journalService";
import { useAppStore } from "../../store/appStore";
import type { JournalEntry } from "../../models/journalModels";
import { useTheme } from "../../theme/provider";
import { getFilteredTags } from "../../utils/journalEntryCard";

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
            <Text
              style={[styles.tagChipText, { color: theme.colors.secondaryForeground }]}
            >
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
  const activeTab = useAppStore(state => state.activeTab);
  const entryId = useAppStore(state => state.selectedJournalEntryId);
  const entries = useAppStore(state => state.recentJournalEntries);
  const closeJournalEntry = useAppStore(state => state.closeJournalEntry);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const openNewEntry = useAppStore(state => state.openNewEntry);
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
  const layoutMaxWidth = isWide ? 430 : 390;

  const entry = useMemo(
    () => hydratedEntry || entries.find(current => current._id === entryId) || null,
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
        // Keep locally cached data if the refresh fails.
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

  const handleBottomNavPress = (nextTab: BottomNavKey) => {
    if (nextTab === "new") {
      closeJournalEntry();
      openNewEntry();
      return;
    }

    closeJournalEntry();
    setActiveTab(nextTab);
  };

  const renderBottomNav = (
    <BottomNav activeKey={activeTab} onPress={handleBottomNavPress} />
  );

  if (!entryId) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.emptyShell, { paddingHorizontal: horizontalPadding }]}>
          <View style={[styles.emptyState, { maxWidth: layoutMaxWidth }]}>
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
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.backButtonText, { color: theme.colors.foreground }]}>
                Go home
              </Text>
            </Pressable>
          </View>
        </View>
        {renderBottomNav}
      </SafeAreaView>
    );
  }

  if (!entry && isRefreshing) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.emptyShell, { paddingHorizontal: horizontalPadding }]}>
          <View style={[styles.emptyState, { maxWidth: layoutMaxWidth }]}>
            <Loader2 size={22} color={theme.colors.primary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
              Loading entry
            </Text>
          </View>
        </View>
        {renderBottomNav}
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.emptyShell, { paddingHorizontal: horizontalPadding }]}>
          <View style={[styles.emptyState, { maxWidth: layoutMaxWidth }]}>
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
        </View>
        {renderBottomNav}
      </SafeAreaView>
    );
  }

  const favoriteLabel = entry.isFavorite ? "Remove favorite" : "Add favorite";
  const visibleTags = getFilteredTags(entry.tags);
  const hasMoodTag = entry.tags.some(tag => tag.toLowerCase().startsWith("mood:"));

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
              hitSlop={8}
              style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
            >
              <ArrowLeft size={18} color={theme.colors.foreground} />
            </Pressable>

            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favoriteLabel}
                onPress={handleToggleFavorite}
                disabled={isTogglingFavorite}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  pressed && !isTogglingFavorite && styles.pressed,
                ]}
              >
                {isTogglingFavorite ? (
                  <Loader2 size={16} color={theme.colors.primary} />
                ) : (
                  <Star
                    size={16}
                    fill={entry.isFavorite ? theme.colors.primary : "transparent"}
                    color={entry.isFavorite ? theme.colors.primary : theme.colors.foreground}
                  />
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit entry"
                onPress={() => openJournalEditor(entry._id)}
                hitSlop={8}
                style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
              >
                <Edit2 size={16} color={theme.colors.foreground} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
                onPress={handleDelete}
                disabled={isDeleting}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerIconButton,
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

          <View
            style={[
              styles.headerDivider,
              { borderTopColor: theme.colors.border },
            ]}
          />

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.body}>
              <View style={styles.metaRow}>
                <Heart
                  size={16}
                  color={hasMoodTag ? theme.colors.success : theme.colors.mutedForeground}
                />
                <Text style={[styles.dateText, { color: theme.colors.mutedForeground }]}>
                  {formatEntryDate(entry.createdAt)}
                </Text>
              </View>

              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {entry.title}
              </Text>

              <Text style={[styles.contentText, { color: theme.colors.foreground }]}>
                {entry.content}
              </Text>

              <View style={[styles.sectionDivider, { borderTopColor: theme.colors.border }]}>
                <JournalTags tags={visibleTags} />
              </View>

              {entry.aiPrompt ? (
                <View style={styles.promptBlock}>
                  <JournalPromptCard prompt={entry.aiPrompt} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
      {renderBottomNav}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  emptyShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerDivider: {
    borderTopWidth: 1,
    marginBottom: 20,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING + 24,
  },
  body: {
    gap: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 23,
  },
  sectionDivider: {
    borderTopWidth: 1,
    paddingTop: 18,
  },
  promptBlock: {
    marginTop: 4,
  },
  tagSection: {
    gap: 12,
  },
  tagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.72,
  },
});
