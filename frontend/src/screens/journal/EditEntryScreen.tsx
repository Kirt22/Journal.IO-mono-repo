import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowLeft,
  Heart,
  Loader2,
  Save,
  Tag,
  X,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, {
  BOTTOM_NAV_CONTENT_PADDING,
  type BottomNavKey,
} from "../../components/BottomNav";
import JournalPromptCard from "../../components/JournalPromptCard";
import { getJournalEntry, updateJournalEntry } from "../../services/journalService";
import { useAppStore } from "../../store/appStore";
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

export default function EditEntryScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const activeTab = useAppStore(state => state.activeTab);
  const entryId = useAppStore(state => state.selectedJournalEntryId);
  const entries = useAppStore(state => state.recentJournalEntries);
  const closeJournalEditor = useAppStore(state => state.closeJournalEditor);
  const closeJournalEntry = useAppStore(state => state.closeJournalEntry);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const openNewEntry = useAppStore(state => state.openNewEntry);
  const openJournalEntry = useAppStore(state => state.openJournalEntry);
  const updateRecentJournalEntry = useAppStore(
    state => state.updateRecentJournalEntry
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 430 : 390;

  const entry = useMemo(
    () => entries.find(current => current._id === entryId) || null,
    [entryId, entries]
  );

  useEffect(() => {
    if (!entryId) {
      return;
    }

    let isActive = true;

    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setTags(getFilteredTags(entry.tags));
      setHiddenTags(
        entry.tags.filter(tag => tag.toLowerCase().startsWith("mood:"))
      );
      setError(null);
      setIsRefreshing(false);
      return () => {
        isActive = false;
      };
    }

    setIsRefreshing(true);

    getJournalEntry(entryId)
      .then(fetchedEntry => {
        if (!isActive) {
          return;
        }

        setTitle(fetchedEntry.title);
        setContent(fetchedEntry.content);
        setTags(getFilteredTags(fetchedEntry.tags));
        setHiddenTags(
          fetchedEntry.tags.filter(tag => tag.toLowerCase().startsWith("mood:"))
        );
        setError(null);
        updateRecentJournalEntry(fetchedEntry);
      })
      .catch(() => {
        // Keep the empty state if the fetch fails.
      })
      .finally(() => {
        if (isActive) {
          setIsRefreshing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [entry, entryId, updateRecentJournalEntry]);

  const handleSave = async () => {
    if (!entry) {
      return;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setError("Please write something before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedEntry = await updateJournalEntry({
        journalId: entry._id,
        title: title.trim() || `Entry for ${formatEntryDate(entry.createdAt)}`,
        content: trimmedContent,
        type: entry.type,
        tags: Array.from(new Set([...hiddenTags, ...tags])),
        images: entry.images || [],
        isFavorite: entry.isFavorite ?? false,
      });

      updateRecentJournalEntry(updatedEntry);
      openJournalEntry(updatedEntry._id);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update this entry right now."
      );
    } finally {
      setIsSaving(false);
    }
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

  if (!entry) {
    if (isRefreshing) {
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
              Open a journal entry first to edit it.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={closeJournalEditor}
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
                Back
              </Text>
            </Pressable>
          </View>
        </View>
        {renderBottomNav}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
          <View style={[styles.shell, { maxWidth: layoutMaxWidth }]}>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={closeJournalEditor}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  pressed && styles.pressed,
                ]}
              >
                <ArrowLeft size={18} color={theme.colors.foreground} />
              </Pressable>

              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel edit"
                  onPress={closeJournalEditor}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <X size={14} color={theme.colors.foreground} />
                  <Text style={[styles.cancelButtonText, { color: theme.colors.foreground }]}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save entry"
                  onPress={handleSave}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.saveButton,
                    {
                      backgroundColor: theme.colors.primary,
                    },
                    pressed && !isSaving && styles.pressed,
                    isSaving && styles.saveButtonSaving,
                  ]}
                >
                  {isSaving ? (
                    <Loader2 size={14} color={theme.colors.primaryForeground} />
                  ) : (
                    <Save size={14} color={theme.colors.primaryForeground} />
                  )}
                  <Text
                    style={[
                      styles.saveButtonText,
                      { color: theme.colors.primaryForeground },
                    ]}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Text>
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
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.body}>
                <View style={styles.metaRow}>
                  <Heart size={16} color={theme.colors.success} />
                  <Text style={[styles.metaText, { color: theme.colors.mutedForeground }]}>
                    {formatEntryDate(entry.createdAt)}
                  </Text>
                </View>

                <TextInput
                  accessibilityLabel="Entry title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Give your entry a title (optional)"
                  placeholderTextColor={theme.colors.mutedForeground}
                  autoCapitalize="sentences"
                  style={[
                    styles.titleInput,
                    {
                      color: theme.colors.foreground,
                      borderBottomColor: theme.colors.border,
                      backgroundColor: theme.colors.inputBackground,
                    },
                  ]}
                />

                <TextInput
                  accessibilityLabel="Entry content"
                  value={content}
                  onChangeText={setContent}
                  placeholder="Write your entry..."
                  placeholderTextColor={theme.colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.contentInput,
                    {
                      color: theme.colors.foreground,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                />

                <View style={styles.wordCountRow}>
                  <Text style={[styles.metaText, { color: theme.colors.mutedForeground }]}>
                    {content.trim().split(/\s+/).filter(Boolean).length} words
                  </Text>
                </View>

                <View
                  style={[
                    styles.tagsSection,
                    { borderTopColor: theme.colors.border },
                  ]}
                >
                  <View style={styles.tagsSectionHeader}>
                    <Tag size={14} color={theme.colors.mutedForeground} />
                    <Text style={[styles.sectionLabel, { color: theme.colors.foreground }]}>
                      Tags
                    </Text>
                  </View>

                  {tags.length ? (
                    <View style={styles.chipRow}>
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
                            style={[
                              styles.tagChipText,
                              { color: theme.colors.secondaryForeground },
                            ]}
                          >
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                {error ? (
                  <Text style={[styles.errorText, { color: theme.colors.destructive }]}>
                    {error}
                  </Text>
                ) : null}

                {entry.aiPrompt ? (
                  <View style={styles.promptBlock}>
                    <JournalPromptCard prompt={entry.aiPrompt} />
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      {renderBottomNav}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
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
    gap: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  saveButtonSaving: {
    opacity: 0.78,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  content: {
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING + 24,
  },
  body: {
    gap: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  titleInput: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderBottomWidth: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "400",
    letterSpacing: -0.3,
  },
  contentInput: {
    minHeight: 320,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
  },
  wordCountRow: {
    marginTop: -2,
  },
  tagsSection: {
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: 1,
  },
  tagsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
  },
  promptBlock: {
    marginTop: 8,
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
