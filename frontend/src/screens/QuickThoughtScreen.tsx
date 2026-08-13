import HapticPressable from '../components/HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
  TextInput,
} from '../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hash, X } from 'lucide-react-native';
import AnimatedTagChip from '../components/AnimatedTagChip';
import ButtonLoadingContent from '../components/ButtonLoadingContent';
import { createJournalEntry } from '../services/journalService';
import { triggerHaptic } from '../services/hapticsService';
import { reconcileStreakWidget } from '../services/widgetService';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/provider';
import { useConnectivity } from '../hooks/useConnectivity';
import { useReduceMotion } from '../hooks/useReduceMotion';

const QUICK_TAGS = ['thought', 'idea', 'reminder', 'gratitude', 'dream'];
const MAX_LENGTH = 500;
const QUICK_THOUGHT_ICON = require('../assets/png/home/quill-pen.png');

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

type QuickThoughtScreenProps = {
  onClose: () => void;
};

export default function QuickThoughtScreen({ onClose }: QuickThoughtScreenProps) {
  const theme = useTheme();
  const { status: connectivityStatus } = useConnectivity();
  const isOnline = connectivityStatus === 'online';
  const addRecentJournalEntry = useAppStore(state => state.addRecentJournalEntry);
  const inputRef = useRef<TextInput>(null);
  const saveHighlight = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const shouldAnimate = !reduceMotion;

  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedNote = note.trim();
  const hasSavableDraft = isOnline && Boolean(trimmedNote);
  const canSave = hasSavableDraft && !isSaving;

  // The save button only becomes a real primary action once there is something
  // to save — reveal it with the sanctioned conditional-action spring. This
  // tracks the draft rather than `canSave` so the button stays lit while the
  // save is in flight and its spinner keeps its contrast.
  useEffect(() => {
    const target = hasSavableDraft ? 1 : 0;

    if (!shouldAnimate) {
      saveHighlight.setValue(target);
      return;
    }

    saveHighlight.stopAnimation();
    const animation = Animated.spring(saveHighlight, {
      toValue: target,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [hasSavableDraft, saveHighlight, shouldAnimate]);

  const saveButtonBackgroundColor = saveHighlight.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.muted, theme.colors.primary],
  });
  const saveButtonOpacity = saveHighlight.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const saveButtonScale = saveHighlight.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [1, 1.035, 1],
    extrapolate: 'clamp',
  });
  const saveButtonForeground = hasSavableDraft
    ? theme.colors.primaryForeground
    : theme.colors.mutedForeground;

  const handleToggleTag = (tag: string) => {
    setSelectedTags(previous =>
      previous.includes(tag)
        ? previous.filter(current => current !== tag)
        : [...previous, tag],
    );
  };

  const handleClose = () => {
    triggerHaptic('back').catch(() => undefined);
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }

    setError(null);
    setIsSaving(true);
    triggerHaptic('primaryAction').catch(() => undefined);

    try {
      const savedEntry = await createJournalEntry({
        title: 'Quick Thought',
        content: trimmedNote,
        type: 'open_ended',
        entryKind: 'quick_thought',
        tags: [...selectedTags],
      });

      addRecentJournalEntry(savedEntry);
      reconcileStreakWidget().catch(() => undefined);
      onClose();
    } catch {
      setError(
        "We couldn't save this thought right now. Your draft is still here.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerLeading}>
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
              ]}
            >
              <Image
                accessible={false}
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={QUICK_THOUGHT_ICON}
                style={styles.headerIconImage}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                Quick thought
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
                Capture what's on your mind
              </Text>
            </View>
          </View>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Close quick thought"
            onPress={handleClose}
            hitSlop={8}
            style={({ pressed }) => [
              styles.closeButton,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
              },
              pressed && styles.pressed,
            ]}
          >
            <X size={16} color={theme.colors.mutedForeground} />
          </HapticPressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            ref={inputRef}
            autoFocus
            value={note}
            onChangeText={value => {
              setNote(value);
              setError(null);
            }}
            placeholder="What's on your mind?"
            placeholderTextColor={theme.colors.mutedForeground}
            multiline
            maxLength={MAX_LENGTH}
            textAlignVertical="top"
            style={[
              styles.input,
              {
                color: theme.colors.foreground,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          />

          <View style={styles.tagsRow}>
            <Hash size={12} color={theme.colors.mutedForeground} />
            {QUICK_TAGS.map(tag => (
              <AnimatedTagChip
                key={tag}
                label={tag}
                onPress={() => handleToggleTag(tag)}
                selected={selectedTags.includes(tag)}
                shouldAnimate={shouldAnimate}
                style={styles.tagChip}
                textStyle={styles.tagText}
              />
            ))}
          </View>

          {error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, { color: theme.colors.destructive }]}
            >
              {error}
            </Text>
          ) : null}

          {!isOnline ? (
            <Text style={[styles.offline, { color: theme.colors.mutedForeground }]}>
              You're offline. Reconnect to save this thought.
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.count, { color: theme.colors.mutedForeground }]}>
            {note.length}/{MAX_LENGTH}
          </Text>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Save quick thought"
            accessibilityState={{ busy: isSaving, disabled: !canSave }}
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => (pressed && canSave ? styles.pressed : undefined)}
          >
            <Animated.View
              style={[
                styles.saveButton,
                {
                  backgroundColor: saveButtonBackgroundColor,
                  opacity: saveButtonOpacity,
                  transform: [{ scale: saveButtonScale }],
                },
              ]}
            >
              <ButtonLoadingContent
                loaderColor={theme.colors.primaryForeground}
                loading={isSaving}
              >
                <Text
                  style={[styles.saveButtonText, { color: saveButtonForeground }]}
                >
                  Save
                </Text>
              </ButtonLoadingContent>
            </Animated.View>
          </HapticPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconImage: {
    width: 20,
    height: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  input: {
    minHeight: 180,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
  },
  tagsRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  error: {
    marginTop: 16,
    fontSize: 13,
  },
  offline: {
    marginTop: 16,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  count: {
    fontSize: 12,
  },
  saveButton: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
