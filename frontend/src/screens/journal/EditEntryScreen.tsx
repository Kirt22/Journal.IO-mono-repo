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
  Loader2,
  Plus,
  Save,
  Tag,
  X,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateJournalEntry } from "../../services/journalService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function AddTagInput({
  value,
  onChangeText,
  onAdd,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.tagInputRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onAdd}
        style={[
          styles.tagInput,
          {
            color: theme.colors.foreground,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add tag"
        onPress={onAdd}
        style={({ pressed }) => [
          styles.tagAddButton,
          {
            backgroundColor: theme.colors.primary,
          },
          pressed && styles.pressed,
        ]}
      >
        <Plus size={16} color={theme.colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

export default function EditEntryScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const entryId = useAppStore(state => state.selectedJournalEntryId);
  const entries = useAppStore(state => state.recentJournalEntries);
  const closeJournalEditor = useAppStore(state => state.closeJournalEditor);
  const openJournalEntry = useAppStore(state => state.openJournalEntry);
  const updateRecentJournalEntry = useAppStore(
    state => state.updateRecentJournalEntry
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;

  const entry = useMemo(
    () => entries.find(current => current._id === entryId) || null,
    [entryId, entries]
  );

  useEffect(() => {
    if (!entry) {
      return;
    }

    setTitle(entry.title);
    setContent(entry.content);
    setTags(entry.tags);
    setTagInput("");
  }, [entry]);

  const handleAddTag = () => {
    const nextTag = tagInput.trim().toLowerCase();

    if (!nextTag || tags.includes(nextTag)) {
      return;
    }

    setTags(previous => [...previous, nextTag]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags(previous => previous.filter(current => current !== tag));
  };

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
        tags,
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
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <ArrowLeft size={18} color={theme.colors.foreground} />
              </Pressable>

              <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>
                Edit Entry
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save entry"
                onPress={handleSave}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                  pressed && !isSaving && styles.pressed,
                  isSaving && styles.saveButtonSaving,
                ]}
              >
                {isSaving ? (
                  <Loader2 size={14} color={theme.colors.primary} />
                ) : (
                  <Save size={14} color={theme.colors.primary} />
                )}
                <Text style={[styles.saveButtonText, { color: theme.colors.primary }]}>
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
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
                <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
                  Editing a journal entry
                </Text>

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
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                />

                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, { color: theme.colors.mutedForeground }]}>
                    {content.trim().split(/\s+/).filter(Boolean).length} words
                  </Text>
                  <Text style={[styles.metaText, { color: theme.colors.mutedForeground }]}>
                    Updated {formatEntryDate(entry.updatedAt)}
                  </Text>
                </View>

                <View style={styles.tagsSection}>
                  <View style={styles.tagsSectionHeader}>
                    <Tag size={14} color={theme.colors.mutedForeground} />
                    <Text style={[styles.sectionLabel, { color: theme.colors.foreground }]}>
                      Tags
                    </Text>
                  </View>

                  <AddTagInput
                    value={tagInput}
                    onChangeText={setTagInput}
                    onAdd={handleAddTag}
                    placeholder="Add a tag..."
                  />

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
                          <Text style={[styles.tagChipText, { color: theme.colors.secondaryForeground }]}>
                            {tag}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${tag}`}
                            onPress={() => handleRemoveTag(tag)}
                            style={({ pressed }) => [
                              styles.tagRemoveButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <X size={12} color={theme.colors.mutedForeground} />
                          </Pressable>
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
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveButtonSaving: {
    opacity: 0.78,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  titleInput: {
    marginTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    fontSize: 24,
    fontWeight: "600",
  },
  contentInput: {
    minHeight: 250,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 12,
  },
  metaText: {
    fontSize: 12,
  },
  tagsSection: {
    marginTop: 18,
  },
  tagsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tagInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  tagAddButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
    paddingRight: 6,
    paddingVertical: 7,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagRemoveButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    marginTop: 14,
    fontSize: 13,
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
