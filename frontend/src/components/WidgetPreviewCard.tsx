import { Flame, SquarePen } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Text } from '../infrastructure/reactNative';
import {
  MOOD_WIDGET_KIND,
  QUICK_THOUGHT_WIDGET_KIND,
  STREAK_WIDGET_KIND,
  type WidgetKind,
} from '../services/widgetBridge';
import { useTheme } from '../theme/provider';

type WidgetPreviewCardProps = {
  kind: WidgetKind;
};

const STREAK_ACTIVITY = [
  true,
  false,
  true,
  true,
  false,
  true,
  true,
  true,
  false,
  true,
  true,
  false,
  true,
  true,
  true,
  false,
  true,
  true,
  false,
  true,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  false,
  true,
  true,
];

const MOODS = [
  { emoji: '🤩', label: 'Amazing' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😌', label: 'Okay' },
  { emoji: '😔', label: 'Bad' },
  { emoji: '😢', label: 'Terrible' },
];

function StreakPreview() {
  const theme = useTheme();

  return (
    <View style={styles.streakLayout}>
      <View style={styles.streakSummary}>
        <View style={styles.streakStatus}>
          <Flame
            color={theme.colors.primary}
            fill={theme.colors.primary}
            size={17}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.streakStatusText,
              { color: theme.colors.mutedForeground },
            ]}
          >
            On track today
          </Text>
        </View>

        <View style={styles.streakValueRow}>
          <Text
            style={[styles.streakValue, { color: theme.colors.foreground }]}
          >
            5
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.streakLabel,
              { color: theme.colors.mutedForeground },
            ]}
          >
            day streak
          </Text>
        </View>

        <View style={styles.compactStats}>
          <View>
            <Text
              style={[
                styles.compactStatValue,
                { color: theme.colors.foreground },
              ]}
            >
              12
            </Text>
            <Text
              style={[
                styles.compactStatLabel,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Best
            </Text>
          </View>
          <View>
            <Text
              style={[
                styles.compactStatValue,
                { color: theme.colors.foreground },
              ]}
            >
              9
            </Text>
            <Text
              style={[
                styles.compactStatLabel,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Month
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.activityPanel}>
        <Text
          numberOfLines={1}
          style={[styles.activityTitle, { color: theme.colors.foreground }]}
        >
          30-Day Activity
        </Text>
        <View testID="streak-activity-grid" style={styles.activityGrid}>
          {STREAK_ACTIVITY.map((isActive, index) => (
            <View
              key={`${isActive}-${index}`}
              testID={`streak-activity-cell-${index}`}
              style={[
                styles.activityCell,
                {
                  backgroundColor: isActive
                    ? theme.colors.primary
                    : theme.colors.primary + '21',
                },
              ]}
            >
              {index === STREAK_ACTIVITY.length - 1 ? (
                <View
                  style={[
                    styles.activityCellOutline,
                    { borderColor: theme.colors.primary + '8C' },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.activityCaption,
            { color: theme.colors.mutedForeground },
          ]}
        >
          Your writing consistency
        </Text>
      </View>
    </View>
  );
}

function MoodPreview() {
  const theme = useTheme();

  return (
    <View style={styles.moodLayout}>
      <Text style={[styles.moodTitle, { color: theme.colors.foreground }]}>
        How are you feeling?
      </Text>

      <View style={styles.moodChoices}>
        {MOODS.map(mood => (
          <View
            key={mood.label}
            style={[
              styles.moodChoice,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.moodLabel,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {mood.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function QuickThoughtPreview() {
  const theme = useTheme();

  return (
    <View style={styles.quickThoughtLayout}>
      <View
        style={[
          styles.quickThoughtIcon,
          { backgroundColor: theme.colors.primary + '24' },
        ]}
      >
        <SquarePen color={theme.colors.primary} size={22} />
      </View>

      <View style={styles.quickThoughtCopy}>
        <Text
          style={[styles.quickThoughtTitle, { color: theme.colors.foreground }]}
        >
          Quick thought
        </Text>
        <Text
          numberOfLines={2}
          style={[
            styles.quickThoughtSubtitle,
            { color: theme.colors.mutedForeground },
          ]}
        >
          Capture what&apos;s on your mind
        </Text>
      </View>

      <View
        style={[
          styles.writePill,
          { backgroundColor: theme.colors.primary + '1F' },
        ]}
      >
        <Text style={[styles.writePillText, { color: theme.colors.primary }]}>
          Write
        </Text>
        <Text style={[styles.writeArrow, { color: theme.colors.primary }]}>
          →
        </Text>
      </View>
    </View>
  );
}

export default function WidgetPreviewCard({ kind }: WidgetPreviewCardProps) {
  const theme = useTheme();

  return (
    <View
      testID={`widget-preview-${kind}`}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.primary + '59',
          shadowColor: theme.colors.foreground,
        },
      ]}
    >
      {kind === STREAK_WIDGET_KIND ? <StreakPreview /> : null}
      {kind === MOOD_WIDGET_KIND ? <MoodPreview /> : null}
      {kind === QUICK_THOUGHT_WIDGET_KIND ? <QuickThoughtPreview /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 2.08,
    borderRadius: 22,
    borderWidth: 1.5,
    elevation: 4,
    overflow: 'hidden',
    padding: 16,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    width: '100%',
  },
  streakLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  streakSummary: {
    flex: 0.9,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  streakStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  streakStatusText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '600',
  },
  streakValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 5,
  },
  streakValue: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  streakLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '500',
  },
  compactStats: {
    flexDirection: 'row',
    gap: 24,
    paddingLeft: 4,
  },
  compactStatValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 17,
  },
  compactStatLabel: {
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 12,
  },
  activityPanel: {
    flexShrink: 0,
    justifyContent: 'space-between',
    minWidth: 0,
    width: 147,
  },
  activityTitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityGrid: {
    alignContent: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    width: 147,
  },
  activityCell: {
    borderRadius: 3,
    height: 12,
    position: 'relative',
    width: 12,
  },
  activityCellOutline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    borderWidth: 1,
  },
  activityCaption: {
    fontSize: 9,
  },
  moodLayout: {
    flex: 1,
    gap: 12,
  },
  moodTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  moodChoices: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
  },
  moodChoice: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
  },
  moodEmoji: {
    fontSize: 23,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  moodLabel: {
    fontSize: 8,
    fontWeight: '600',
  },
  quickThoughtLayout: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 14,
  },
  quickThoughtIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quickThoughtCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  quickThoughtTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  quickThoughtSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  writePill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  writePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  writeArrow: {
    fontSize: 13,
    fontWeight: '600',
  },
});
