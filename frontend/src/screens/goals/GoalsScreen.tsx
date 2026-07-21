import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, Plus, Target, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import {
  createGoal,
  deleteGoal,
  getGoals,
  type SavedGoal,
} from '../../services/goalsService';
import { useTheme } from '../../theme/provider';

type GoalsScreenProps = {
  onBack: () => void;
};

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default function GoalsScreen({ onBack }: GoalsScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [goals, setGoals] = useState<SavedGoal[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 430 : 390;
  const trimmedDraftTitle = draftTitle.trim();
  const canSave = trimmedDraftTitle.length > 0 && !isSaving;

  useEffect(() => {
    let isActive = true;

    const loadGoals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getGoals();

        if (isActive) {
          setGoals(response);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We couldn't load your goals right now.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadGoals().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  const goalCountLabel = useMemo(() => {
    if (goals.length === 1) {
      return '1 active goal';
    }

    return `${goals.length} active goals`;
  }, [goals.length]);

  const handleSaveGoal = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const savedGoal = await createGoal(trimmedDraftTitle);

      setGoals(currentGoals => {
        const nextGoals = currentGoals.filter(goal => goal.id !== savedGoal.id);
        return [savedGoal, ...nextGoals];
      });
      setDraftTitle('');
    } catch (saveGoalError) {
      setSaveError(
        saveGoalError instanceof Error
          ? saveGoalError.message
          : "We couldn't save that goal right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setDeletingGoalId(goalId);
    setSaveError(null);

    try {
      await deleteGoal(goalId);
      setGoals(currentGoals => currentGoals.filter(goal => goal.id !== goalId));
    } catch (deleteError) {
      setSaveError(
        deleteError instanceof Error
          ? deleteError.message
          : "We couldn't remove that goal right now.",
      );
    } finally {
      setDeletingGoalId(null);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            backgroundColor: theme.colors.background,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.shell, { maxWidth: layoutMaxWidth }]}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back"
              onPress={onBack}
              style={({ pressed }) => [
                styles.headerButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft color={theme.colors.foreground} size={18} />
            </Pressable>
            <Text
              style={[styles.headerTitle, { color: theme.colors.foreground }]}
            >
              Goals
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: toRgba(theme.colors.primary, 0.08),
                borderColor: toRgba(theme.colors.primary, 0.22),
              },
            ]}
          >
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: toRgba(theme.colors.primary, 0.12) },
              ]}
            >
              <Target color={theme.colors.primary} size={20} />
            </View>
            <Text
              style={[styles.heroTitle, { color: theme.colors.foreground }]}
            >
              Keep your next steps simple
            </Text>
            <Text
              style={[styles.heroBody, { color: theme.colors.mutedForeground }]}
            >
              Goals are user-owned and lightweight here. Add only the ones you
              want to actively keep in view.
            </Text>
            <Text style={[styles.heroMeta, { color: theme.colors.primary }]}>
              {goalCountLabel}
            </Text>
          </View>

          <View
            style={[
              styles.createCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              Add a manual goal
            </Text>
            <Text
              style={[
                styles.sectionBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              A short title is enough. You can use goals for habits, reminders
              to yourself, or one next step from today.
            </Text>
            <TextInput
              accessibilityLabel="Goal title"
              placeholder="Example: Write one honest line before bed"
              placeholderTextColor={theme.colors.mutedForeground}
              style={[
                styles.input,
                {
                  color: theme.colors.foreground,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.background,
                },
              ]}
              value={draftTitle}
              onChangeText={setDraftTitle}
              onSubmitEditing={() => {
                handleSaveGoal();
              }}
              returnKeyType="done"
            />
            {saveError ? (
              <Text
                style={[styles.errorText, { color: theme.colors.destructive }]}
              >
                {saveError}
              </Text>
            ) : null}
            <Pressable
              accessibilityLabel="Save goal"
              accessibilityState={{ busy: isSaving, disabled: !canSave }}
              onPress={handleSaveGoal}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: canSave
                    ? theme.colors.primary
                    : theme.colors.secondary,
                },
                pressed && canSave && styles.pressed,
              ]}
            >
              <ButtonLoadingContent
                contentStyle={styles.saveButtonContent}
                loaderColor={theme.colors.primaryForeground}
                loading={isSaving}
              >
                <Plus color={theme.colors.primaryForeground} size={16} />
              <Text
                style={[
                  styles.saveButtonText,
                  { color: theme.colors.primaryForeground },
                ]}
              >
                Add goal
              </Text>
              </ButtonLoadingContent>
            </Pressable>
          </View>

          <View style={styles.listSection}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              Active goals
            </Text>
            {isLoading ? (
              <View
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <ActivityIndicator color={theme.colors.primary} size="small" />
                <Text
                  style={[
                    styles.statusText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Loading your goals...
                </Text>
              </View>
            ) : error ? (
              <View
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.errorText,
                    { color: theme.colors.destructive },
                  ]}
                >
                  {error}
                </Text>
              </View>
            ) : goals.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: theme.colors.foreground },
                  ]}
                >
                  Nothing saved yet
                </Text>
                <Text
                  style={[
                    styles.emptyBody,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Add one small goal you want visible on purpose. You can keep
                  this list calm and short.
                </Text>
              </View>
            ) : (
              <View style={styles.goalList}>
                {goals.map(goal => (
                  <View
                    key={goal.id}
                    style={[
                      styles.goalCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.goalTitle,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      {goal.title}
                    </Text>
                    <Pressable
                      accessibilityLabel={`Remove goal ${goal.title}`}
                      accessibilityState={{
                        busy: deletingGoalId === goal.id,
                        disabled: deletingGoalId === goal.id,
                      }}
                      onPress={() => {
                        handleDeleteGoal(goal.id);
                      }}
                      disabled={deletingGoalId === goal.id}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        {
                          backgroundColor: toRgba(
                            theme.colors.destructive,
                            0.08,
                          ),
                          borderColor: toRgba(theme.colors.destructive, 0.18),
                        },
                        pressed && deletingGoalId !== goal.id && styles.pressed,
                      ]}
                    >
                      <ButtonLoadingContent
                        loaderColor={theme.colors.destructive}
                        loading={deletingGoalId === goal.id}
                      >
                        <Trash2 color={theme.colors.destructive} size={16} />
                      </ButtonLoadingContent>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 132,
  },
  shell: {
    width: '100%',
    gap: 20,
    paddingTop: 6,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: '700',
  },
  createCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  listSection: {
    gap: 12,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 148,
    padding: 20,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    minHeight: 148,
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  goalList: {
    gap: 12,
  },
  goalCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  goalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
