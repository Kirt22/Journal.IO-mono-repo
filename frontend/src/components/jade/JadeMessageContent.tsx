import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Text } from '../../infrastructure/reactNative';
import type { JadeMessageBlock } from '../../services/askJadeService';
import { useTheme } from '../../theme/provider';
import { typography } from '../../theme/typography';

type Props = {
  blocks: JadeMessageBlock[];
  displayedText: string | null;
  fallbackText: string;
  showRich: boolean;
};

const emptyCopy = (state: 'empty' | 'unavailable') =>
  state === 'empty'
    ? 'Not enough check-ins yet. This view will fill in as you keep tracking.'
    : 'This data view is temporarily unavailable.';

function DataState({ state }: { state: 'empty' | 'unavailable' }) {
  const theme = useTheme();
  return (
    <Text style={[styles.emptyText, { color: theme.colors.mutedForeground }]}>
      {emptyCopy(state)}
    </Text>
  );
}

function MoodTrend({
  block,
}: {
  block: Extract<JadeMessageBlock, { type: 'mood_trend' }>;
}) {
  const theme = useTheme();
  if (block.dataState !== 'ready') return <DataState state={block.dataState} />;

  const points = block.points;
  const toX = (index: number) =>
    points.length <= 1 ? 140 : (index / (points.length - 1)) * 276 + 2;
  const toY = (score: number) => 94 - ((score - 1) / 4) * 84;
  const segments: string[][] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.score === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push(`${toX(index)},${toY(point.score)}`);
  });
  if (current.length) segments.push(current);

  const summary = points
    .filter(point => point.mood)
    .map(point => `${point.label}: ${point.mood}`)
    .join(', ');

  return (
    <View accessibilityLabel={`${block.title}. ${summary}`} accessible>
      <Svg
        accessibilityElementsHidden
        height={104}
        viewBox="0 0 280 104"
        width="100%"
      >
        {segments.map((segment, index) => (
          <Polyline
            fill="none"
            key={`${segment[0]}-${index}`}
            points={segment.join(' ')}
            stroke={theme.colors.primary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        ))}
        {points.map((point, index) =>
          point.score === null ? null : (
            <Circle
              cx={toX(index)}
              cy={toY(point.score)}
              fill={theme.colors.card}
              key={point.dateKey}
              r={3.5}
              stroke={theme.colors.primary}
              strokeWidth={2}
            />
          ),
        )}
      </Svg>
      <View style={styles.axisRow}>
        <Text
          style={[styles.axisLabel, { color: theme.colors.mutedForeground }]}
        >
          {points[0]?.label || ''}
        </Text>
        <Text
          style={[styles.axisLabel, { color: theme.colors.mutedForeground }]}
        >
          {points[points.length - 1]?.label || ''}
        </Text>
      </View>
    </View>
  );
}

function Stats({
  block,
}: {
  block: Extract<JadeMessageBlock, { type: 'stats' }>;
}) {
  const theme = useTheme();
  if (block.dataState !== 'ready') return <DataState state={block.dataState} />;
  return (
    <View style={styles.statsGrid}>
      {block.items.map(item => (
        <View
          accessibilityLabel={`${item.label}: ${item.value}`}
          accessible
          key={item.label}
          style={[styles.statTile, { backgroundColor: theme.colors.secondary }]}
        >
          <Text style={[styles.statValue, { color: theme.colors.foreground }]}>
            {item.value}
          </Text>
          <Text
            style={[styles.statLabel, { color: theme.colors.mutedForeground }]}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Distribution({
  block,
}: {
  block: Extract<JadeMessageBlock, { type: 'mood_distribution' }>;
}) {
  const theme = useTheme();
  if (block.dataState !== 'ready') return <DataState state={block.dataState} />;
  return (
    <View
      accessibilityLabel={block.segments
        .map(item => `${item.label} ${item.percentage}%`)
        .join(', ')}
      accessible
      style={styles.barList}
    >
      {block.segments.map(item => (
        <View key={item.mood} style={styles.barRow}>
          <Text style={[styles.barLabel, { color: theme.colors.foreground }]}>
            {item.label}
          </Text>
          <View
            style={[styles.barTrack, { backgroundColor: theme.colors.muted }]}
          >
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: `${item.percentage}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[styles.barValue, { color: theme.colors.mutedForeground }]}
          >
            {item.percentage}%
          </Text>
        </View>
      ))}
    </View>
  );
}

function Activity({
  block,
}: {
  block: Extract<JadeMessageBlock, { type: 'activity' }>;
}) {
  const theme = useTheme();
  if (block.dataState !== 'ready') return <DataState state={block.dataState} />;
  const max = Math.max(1, ...block.points.map(point => point.count));
  return (
    <View
      accessibilityLabel={block.points
        .map(point => `${point.label}: ${point.count} entries`)
        .join(', ')}
      accessible
      style={styles.activityRow}
    >
      {block.points.map(point => (
        <View key={point.dateKey} style={styles.activityColumn}>
          <View
            style={[
              styles.activityTrack,
              { backgroundColor: theme.colors.muted },
            ]}
          >
            <View
              style={[
                styles.activityFill,
                {
                  backgroundColor: theme.colors.primary,
                  height: `${Math.max(8, (point.count / max) * 100)}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[styles.axisLabel, { color: theme.colors.mutedForeground }]}
          >
            {point.label.slice(0, 3)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function JadeMessageContent({
  blocks,
  displayedText,
  fallbackText,
  showRich,
}: Props) {
  const theme = useTheme();
  const hasBlocks = blocks.length > 0;
  const prose = blocks.find(block => block.type === 'text');
  const visibleText =
    displayedText !== null
      ? displayedText
      : prose?.type === 'text'
      ? prose.text
      : fallbackText;

  return (
    <View style={styles.root}>
      <Text style={[styles.body, { color: theme.colors.foreground }]}>
        {visibleText}
      </Text>
      {showRich && hasBlocks
        ? blocks.slice(1).map((block, index) => {
            if (block.type === 'text') return null;
            if (block.type === 'list') {
              return (
                <View
                  key={`list-${index}`}
                  style={styles.list}
                  testID="jade-list-block"
                >
                  {block.items.map((item, itemIndex) => (
                    <View key={`${item}-${itemIndex}`} style={styles.listRow}>
                      <Text
                        style={[styles.marker, { color: theme.colors.primary }]}
                      >
                        {block.style === 'numbered' ? `${itemIndex + 1}.` : '•'}
                      </Text>
                      <Text
                        style={[
                          styles.listText,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            }
            return (
              <View
                key={`${block.type}-${index}`}
                style={[
                  styles.dataCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                testID={`jade-${block.type}-block`}
              >
                <Text
                  style={[styles.title, { color: theme.colors.foreground }]}
                >
                  {block.title}
                </Text>
                {block.type === 'stats' ? <Stats block={block} /> : null}
                {block.type === 'mood_trend' ? (
                  <MoodTrend block={block} />
                ) : null}
                {block.type === 'mood_distribution' ? (
                  <Distribution block={block} />
                ) : null}
                {block.type === 'activity' ? <Activity block={block} /> : null}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  body: { ...typography.body },
  list: { gap: 8 },
  listRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  marker: {
    ...typography.bodySm,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'right',
  },
  listText: { ...typography.bodySm, flex: 1 },
  dataCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: 14,
    width: '100%',
  },
  title: { ...typography.subheading },
  emptyText: { ...typography.bodySm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statTile: { borderRadius: 12, padding: 10, width: '48%' },
  statValue: { ...typography.heading },
  statLabel: { ...typography.caption, marginTop: 2 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { ...typography.caption },
  barList: { gap: 9 },
  barRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  barLabel: { ...typography.caption, width: 56 },
  barTrack: { borderRadius: 4, flex: 1, height: 7, overflow: 'hidden' },
  barFill: { borderRadius: 4, height: '100%' },
  barValue: { ...typography.caption, textAlign: 'right', width: 34 },
  activityRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
    height: 100,
  },
  activityColumn: { alignItems: 'center', flex: 1, gap: 4 },
  activityTrack: {
    borderRadius: 5,
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  activityFill: { borderRadius: 5, minHeight: 4, width: '100%' },
});
