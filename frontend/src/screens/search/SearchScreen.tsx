import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
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
  Filter,
  Heart,
  Search as SearchIcon,
  Tag,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import JournalEntryCard from "../../components/JournalEntryCard";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import { getJournalEntries } from "../../services/journalService";
import type { JournalEntry } from "../../models/journalModels";
import { buildSearchTags, filterSearchEntries } from "./searchUtils";
import { BOTTOM_NAV_CONTENT_PADDING } from "../../components/BottomNav";
import mascotImage from "../../assets/png/Masscott.png";

type SearchScreenProps = {
  onBack: () => void;
};

type TagChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

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

function TagChip({ label, selected, onPress }: TagChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tagChip,
        {
          backgroundColor: selected
            ? theme.colors.primary
            : theme.colors.secondary,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.tagChipText,
          {
            color: selected
              ? theme.colors.primaryForeground
              : theme.colors.foreground,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyResults({
  title,
  description,
  onClearFilters,
  showMascot = true,
}: {
  title: string;
  description: string;
  onClearFilters?: () => void;
  showMascot?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.emptyState}>
      {showMascot ? (
        <Image source={mascotImage} style={styles.emptyMascot} resizeMode="contain" />
      ) : (
        <View
          style={[
            styles.emptyIconWrap,
            { backgroundColor: hexToRgba(theme.colors.primary, 0.08) },
          ]}
        >
          <SearchIcon size={28} color={theme.colors.primary} />
        </View>
      )}
      <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.mutedForeground }]}>
        {description}
      </Text>
      {onClearFilters ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearFilters}
          style={({ pressed }) => [
            styles.emptyAction,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.emptyActionText, { color: theme.colors.primaryForeground }]}>
            Clear filters
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function SearchScreen({ onBack }: SearchScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const openJournalEntry = useAppStore(state => state.openJournalEntry);
  const updateRecentJournalEntry = useAppStore(state => state.updateRecentJournalEntry);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const filtersAnimation = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const layoutMaxWidth = isWide ? 460 : 420;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadEntries = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const loadedEntries = await getJournalEntries();

        if (isActive) {
          setEntries(
            [...loadedEntries].sort(
              (left, right) =>
                new Date(right.createdAt).getTime() -
                new Date(left.createdAt).getTime()
            )
          );
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not load your entries right now."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadEntries().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    Animated.timing(filtersAnimation, {
      toValue: showFilters ? 1 : 0,
      duration: showFilters ? 180 : 140,
      easing: showFilters ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [filtersAnimation, showFilters]);

  const filteredEntries = useMemo(
    () =>
      filterSearchEntries(entries, {
        query: searchQuery,
        selectedTags,
        favoritesOnly,
      }),
    [entries, searchQuery, selectedTags, favoritesOnly]
  );

  const searchTags = useMemo(() => buildSearchTags(entries), [entries]);
  const activeFilterCount = selectedTags.length + (favoritesOnly ? 1 : 0);
  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedTags.length > 0 || favoritesOnly;

  const handleToggleTag = (tag: string) => {
    setSelectedTags(previous =>
      previous.includes(tag)
        ? previous.filter(item => item !== tag)
        : [...previous, tag]
    );
  };

  const handleToggleFavorite = async (entryId: string) => {
    const currentEntry = entries.find(entry => entry._id === entryId);

    if (!currentEntry) {
      return;
    }

    const nextFavorite = !currentEntry.isFavorite;

    setEntries(previous =>
      previous.map(entry =>
        entry._id === entryId ? { ...entry, isFavorite: nextFavorite } : entry
      )
    );

    try {
      updateRecentJournalEntry({
        ...currentEntry,
        isFavorite: nextFavorite,
      });
    } catch {
      // Keep the search list responsive even if the local store update is unavailable.
    }
  };

  const clearAll = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setFavoritesOnly(false);
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View
          style={[
            styles.headerShell,
            {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <View style={[styles.headerRow, { maxWidth: layoutMaxWidth }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <ArrowLeft size={20} color={theme.colors.foreground} />
            </Pressable>

            <View
              style={[
                styles.searchField,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: hasActiveFilters
                    ? hexToRgba(theme.colors.primary, 0.7)
                    : theme.colors.border,
                },
              ]}
            >
              <SearchIcon size={18} color={theme.colors.mutedForeground} />
              <TextInput
                ref={inputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search entries..."
                placeholderTextColor={theme.colors.mutedForeground}
                style={[styles.searchInput, { color: theme.colors.foreground }]}
                autoFocus
                returnKeyType="search"
              />
            </View>
          </View>

          <View style={[styles.filterBar, { maxWidth: layoutMaxWidth }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowFilters(previous => !previous)}
              style={({ pressed }) => [
                styles.filterButton,
                {
                  backgroundColor: showFilters
                    ? hexToRgba(theme.colors.primary, 0.12)
                    : theme.colors.secondary,
                  borderColor: showFilters ? theme.colors.primary : theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Filter size={14} color={theme.colors.foreground} />
              <Text style={[styles.filterButtonText, { color: theme.colors.foreground }]}>
                Filters
              </Text>
              {activeFilterCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={[styles.badgeText, { color: theme.colors.primaryForeground }]}>
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            {hasActiveFilters ? (
              <Pressable
                accessibilityRole="button"
                onPress={clearAll}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Text style={[styles.clearButtonText, { color: theme.colors.foreground }]}>
                  Clear all
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: 24 + BOTTOM_NAV_CONTENT_PADDING,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.body, { maxWidth: layoutMaxWidth }]}>
            <Animated.View
              pointerEvents={showFilters ? "auto" : "none"}
              style={[
                styles.filtersCard,
                {
                  backgroundColor: hexToRgba(theme.colors.primary, 0.035),
                  borderColor: hexToRgba(theme.colors.primary, 0.14),
                  opacity: filtersAnimation,
                  transform: [
                    {
                      translateY: filtersAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                  ],
                },
                showFilters ? null : styles.filtersPanelCollapsed,
              ]}
            >
              <View style={styles.filtersHeader}>
                <Tag size={14} color={theme.colors.mutedForeground} />
                <Text style={[styles.filtersTitle, { color: theme.colors.foreground }]}>
                  Filter by Tags
                </Text>
              </View>

              <View style={styles.filterToggleRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFavoritesOnly(previous => !previous)}
                  style={({ pressed }) => [
                    styles.favoriteToggle,
                    {
                      backgroundColor: favoritesOnly
                        ? hexToRgba(theme.colors.primary, 0.12)
                        : theme.colors.secondary,
                      borderColor: favoritesOnly
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Heart
                    size={14}
                    color={favoritesOnly ? theme.colors.primary : theme.colors.mutedForeground}
                    fill={favoritesOnly ? theme.colors.primary : "transparent"}
                  />
                  <Text
                    style={[
                      styles.favoriteToggleText,
                      { color: favoritesOnly ? theme.colors.primary : theme.colors.foreground },
                    ]}
                  >
                    Favorites
                  </Text>
                </Pressable>
              </View>

              <View style={styles.tagGrid}>
                {searchTags.map(tag => (
                  <TagChip
                    key={tag}
                    label={tag}
                    selected={selectedTags.includes(tag)}
                    onPress={() => handleToggleTag(tag)}
                  />
                ))}
              </View>
            </Animated.View>

            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.mutedForeground }]}>
                  Loading entries...
                </Text>
              </View>
            ) : errorMessage ? (
              <EmptyResults
                title="Something went wrong"
                description={errorMessage}
                showMascot={false}
                onClearFilters={undefined}
              />
            ) : filteredEntries.length === 0 ? (
              <EmptyResults
                title={hasActiveFilters ? "No results found" : "Start searching"}
                description={
                  hasActiveFilters
                    ? "Try a different keyword, tag, or favorite filter."
                    : "Search through all your journal entries."
                }
                onClearFilters={hasActiveFilters ? clearAll : undefined}
              />
            ) : (
              <View style={styles.resultsSection}>
                {hasActiveFilters ? (
                  <Text style={[styles.resultsCount, { color: theme.colors.mutedForeground }]}>
                    Found {filteredEntries.length}{" "}
                    {filteredEntries.length === 1 ? "entry" : "entries"}
                  </Text>
                ) : null}

                <View style={styles.resultsList}>
                  {filteredEntries.map(entry => (
                    <JournalEntryCard
                      key={entry._id}
                      entry={entry}
                      onPress={() => openJournalEntry(entry._id)}
                      onFavoritePress={() => handleToggleFavorite(entry._id)}
                      previewLines={2}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
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
  },
  headerShell: {
    borderBottomWidth: 1,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerRow: {
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  searchField: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "center",
    width: "100%",
  },
  filterButton: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    width: "100%",
    alignSelf: "center",
    paddingTop: 8,
    gap: 18,
  },
  filtersCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 15,
    marginBottom: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.11,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 3,
  },
  filtersPanelCollapsed: {
    height: 0,
    paddingVertical: 0,
    marginVertical: 0,
    overflow: "hidden",
  },
  filtersHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  filtersTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  filterToggleRow: {
    marginBottom: 12,
  },
  favoriteToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  favoriteToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 44,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  resultsSection: {
    gap: 14,
  },
  resultsCount: {
    fontSize: 12,
  },
  resultsList: {
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 38,
    paddingHorizontal: 20,
  },
  emptyMascot: {
    width: 82,
    height: 82,
    marginBottom: 14,
    opacity: 0.9,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 260,
  },
  emptyAction: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
