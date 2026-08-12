import HapticPressable from '../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import {
  AlertCircle,
  ChevronDown,
  RefreshCw,
  Sparkles,
} from 'lucide-react-native';
import TabScreenLayout from '../components/TabScreenLayout';
import JournalLoader from '../components/JournalLoader';
import {
  getInsightsAiAnalysis,
  getInsightsOverview,
  type InsightTone,
  type InsightsAiAnalysis,
  type InsightsAiAnalysisReady,
  type InsightsOverview,
} from '../services/insightsService';
import {
  getPaywallConfig,
  trackPaywallEvent,
} from '../services/paywallService';
import {
  cancelWeeklyInsightNotifications,
  syncWeeklyInsightNotifications,
} from '../services/reminderNotificationsService';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/provider';
import { triggerHaptic } from '../services/hapticsService';

const HEADER_INSIGHTS_ICON = require('../assets/png/insights/icons8-combo-chart-100.png');
const AI_ANALYSIS_TAB_ICON = require('../assets/png/entry/icons8-ai-100.png');
const WEEKLY_ANALYSIS_ICON = require('../assets/png/insights/weekly-ai-analysis-icon.png');
const WEEKLY_PROGRESS_ICON = require('../assets/png/insights/icons8-timeline-week-100.png');
const PREMIUM_LOCK_ICON = require('../assets/png/entry/lock.png');
const TOPIC_SNAPSHOT_ICON = require('../assets/png/insights/icons8-topic-48.png');
const PATTERNS_DISCOVERED_ICON = require('../assets/png/insights/icons8-pattern-48.png');
const ACTIONABLE_STEPS_ICON = require('../assets/png/insights/icons8-action-100.png');
const MOOD_DISTRIBUTION_ICON = require('../assets/png/insights/icons8-pie-chart-100.png');
const POPULAR_TOPICS_ICON = require('../assets/png/insights/icons8-quill-48.png');

type InsightTab = 'overview' | 'analysis';
type SwipeTouchEvent = {
  nativeEvent: {
    locationX: number;
    locationY: number;
  };
};

const MOOD_COLORS: Record<string, string> = {
  amazing: '#E6816D',
  good: '#7D9FD6',
  okay: '#E9A15B',
  bad: '#8E939A',
  terrible: '#D26A6A',
};

const TOPIC_COLORS = ['#E6816D', '#7D9FD6', '#8AB39A', '#E9A15B', '#A47BD6'];

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

function getToneColor(tone: InsightTone) {
  switch (tone) {
    case 'coral':
      return '#E6816D';
    case 'blue':
      return '#7D9FD6';
    case 'sage':
      return '#8AB39A';
    case 'amber':
      return '#E9A15B';
    case 'slate':
    default:
      return '#8E939A';
  }
}

function truncateWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return text.trim();
  }

  return `${words.slice(0, maxWords).join(' ')}...`;
}

function useRevealProgress(isVisible: boolean) {
  const progress = useRef(new Animated.Value(isVisible ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();

    if (!isVisible) {
      progress.setValue(0);
      return;
    }

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isVisible, progress]);

  return progress;
}

function RevealSurface({
  children,
  progress,
  style,
  scaleFrom = 0.98,
}: {
  children: ReactNode;
  progress: Animated.Value;
  style?: StyleProp<ViewStyle>;
  scaleFrom?: number;
}) {
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [scaleFrom, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

function TabPill({
  theme,
  label,
  selected,
  icon,
  image,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  label: string;
  selected: boolean;
  icon?: typeof Sparkles;
  image?: ImageSourcePropType;
  onPress: () => void;
}) {
  const Icon = icon;

  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        {
          backgroundColor: selected ? theme.colors.card : 'transparent',
          flex: 1,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.tabPillLabel,
          { color: theme.colors.foreground },
          selected ? styles.tabPillLabelSelected : styles.tabPillLabelDefault,
        ]}
      >
        {label}
      </Text>
      {Icon ? (
        <Icon
          color={selected ? theme.colors.primary : theme.colors.mutedForeground}
          size={14}
        />
      ) : image ? (
        <Image source={image} style={styles.tabPillImage} />
      ) : null}
    </HapticPressable>
  );
}

function Header() {
  const theme = useTheme();

  return (
    <View style={styles.headerRow}>
      <View
        style={[
          styles.headerIconWrap,
          { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
        ]}
      >
        <Image source={HEADER_INSIGHTS_ICON} style={styles.headerIconImage} />
      </View>

      <View style={styles.headerCopy}>
        <Text style={[styles.pageTitle, { color: theme.colors.foreground }]}>
          Insights
        </Text>
        <Text
          style={[styles.pageSubtitle, { color: theme.colors.mutedForeground }]}
        >
          Your journaling patterns & growth
        </Text>
      </View>
    </View>
  );
}

function StatCardView({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: theme.colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function buildLineGeometry({
  width,
  height,
  paddingTop,
  paddingBottom,
  paddingLeft,
  paddingRight,
  values,
  maxValue,
}: {
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  values: number[];
  maxValue: number;
}) {
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const count = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const normalized = Math.max(0, Math.min(maxValue, value)) / maxValue;
    const x = paddingLeft + (plotWidth / count) * index;
    const y = paddingTop + plotHeight - plotHeight * normalized;

    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${paddingLeft + plotWidth} ${
    paddingTop + plotHeight
  } L ${paddingLeft} ${paddingTop + plotHeight} Z`;

  return {
    left: paddingLeft,
    top: paddingTop,
    plotWidth,
    plotHeight,
    points,
    linePath,
    areaPath,
  };
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function buildDonutSegmentPath({
  center,
  outerRadius,
  innerRadius,
  startAngle,
  endAngle,
}: {
  center: number;
  outerRadius: number;
  innerRadius: number;
  startAngle: number;
  endAngle: number;
}) {
  const outerStart = polarToCartesian(center, center, outerRadius, endAngle);
  const outerEnd = polarToCartesian(center, center, outerRadius, startAngle);
  const innerStart = polarToCartesian(center, center, innerRadius, startAngle);
  const innerEnd = polarToCartesian(center, center, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

function buildDonutSegments({
  segments,
  center,
  outerRadius,
  innerRadius,
}: {
  segments: InsightsOverview['moodDistribution'];
  center: number;
  outerRadius: number;
  innerRadius: number;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.percentage, 0),
  );
  let currentAngle = -90;

  return segments.map(segment => {
    const sliceAngle = (segment.percentage / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    return {
      mood: segment.mood,
      label: segment.label,
      path: buildDonutSegmentPath({
        center,
        outerRadius,
        innerRadius,
        startAngle,
        endAngle,
      }),
    };
  });
}

function ActivityChart({
  activity,
  selectedIndex,
  onSelectIndex,
}: {
  activity: InsightsOverview['activity7d'];
  selectedIndex: number;
  onSelectIndex: (nextIndex: number) => void;
}) {
  const theme = useTheme();
  const chartWidth = 260;
  const chartHeight = 172;
  const chartGeometry = useMemo(
    () =>
      buildLineGeometry({
        width: chartWidth,
        height: chartHeight,
        paddingTop: 14,
        paddingBottom: 28,
        paddingLeft: 2,
        paddingRight: 2,
        values: activity.map(item => item.count),
        maxValue: Math.max(4, ...activity.map(item => item.count), 1),
      }),
    [activity],
  );
  const fillColor = hexToRgba(theme.colors.primary, 0.12);
  const mutedLineColor = hexToRgba(theme.colors.secondaryForeground, 0.52);

  return (
    <View style={styles.chartWrap}>
      <View style={styles.yLabels}>
        {['4', '3', '2', '1', '0'].map(label => (
          <Text
            key={label}
            style={[styles.axisLabel, { color: theme.colors.mutedForeground }]}
          >
            {label}
          </Text>
        ))}
      </View>

      <View
        style={[styles.chartBody, { width: chartWidth, height: chartHeight }]}
      >
        <Svg width={chartWidth} height={chartHeight} style={styles.chartSvg}>
          <Defs>
            <LinearGradient id="insights-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={fillColor} stopOpacity="0.85" />
              <Stop offset="100%" stopColor={fillColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {[0, 1, 2, 3, 4].map(index => (
            <Line
              key={`h-${index}`}
              x1={chartGeometry.left}
              x2={chartGeometry.left + chartGeometry.plotWidth}
              y1={chartGeometry.top + (chartGeometry.plotHeight / 4) * index}
              y2={chartGeometry.top + (chartGeometry.plotHeight / 4) * index}
              stroke={hexToRgba(theme.colors.border, 0.85)}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          {[0, 1, 2, 3].map(index => (
            <Line
              key={`v-${index}`}
              x1={chartGeometry.left + (chartGeometry.plotWidth / 4) * index}
              x2={chartGeometry.left + (chartGeometry.plotWidth / 4) * index}
              y1={chartGeometry.top}
              y2={chartGeometry.top + chartGeometry.plotHeight}
              stroke={hexToRgba(theme.colors.border, 0.85)}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          <Path d={chartGeometry.areaPath} fill="url(#insights-fill)" />

          <Path
            d={chartGeometry.linePath}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chartGeometry.points.map((point, index) => (
            <G key={activity[index].dateKey}>
              <Circle
                cx={point.x}
                cy={point.y}
                r={4.5}
                fill={
                  index === selectedIndex
                    ? theme.colors.primary
                    : theme.colors.card
                }
                stroke={
                  index === selectedIndex
                    ? theme.colors.primary
                    : mutedLineColor
                }
                strokeWidth={2}
              />
              <Circle
                cx={point.x}
                cy={point.y}
                r={index === selectedIndex ? 8 : 7}
                fill={
                  index === selectedIndex
                    ? hexToRgba(theme.colors.primary, 0.12)
                    : 'transparent'
                }
              />
            </G>
          ))}
        </Svg>

        <View style={styles.chartOverlay}>
          {chartGeometry.points.map((point, index) => (
            <HapticPressable
              key={`hit-${activity[index].dateKey}`}
              accessibilityRole="button"
              accessibilityLabel={`Select ${activity[index].label} activity`}
              testID={`activity-point-${index}`}
              onPress={() => {
                triggerHaptic('optionSelected').catch(() => undefined);
                onSelectIndex(index);
              }}
              style={[
                styles.chartHitArea,
                {
                  left: point.x - 14,
                  top: point.y - 14,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.chartLabelsRow}>
          {activity.map((item, index) => (
            <Text
              key={item.dateKey}
              style={[
                styles.axisLabel,
                {
                  color:
                    index === selectedIndex
                      ? theme.colors.primary
                      : theme.colors.mutedForeground,
                },
                index === selectedIndex
                  ? styles.axisLabelSelected
                  : styles.axisLabelDefault,
              ]}
            >
              {item.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function BreakdownChart({
  moodDistribution,
  selectedIndex,
  onSelectIndex,
}: {
  moodDistribution: InsightsOverview['moodDistribution'];
  selectedIndex: number;
  onSelectIndex: (nextIndex: number) => void;
}) {
  const theme = useTheme();
  const size = 150;
  const strokeWidth = 18;
  const outerRadius = (size - strokeWidth) / 2;
  const innerRadius = outerRadius - strokeWidth;
  const center = size / 2;
  const selectedSegment =
    moodDistribution[selectedIndex] || moodDistribution[0];
  const segmentPaths = useMemo(
    () =>
      buildDonutSegments({
        segments: moodDistribution,
        center,
        outerRadius,
        innerRadius,
      }),
    [center, innerRadius, moodDistribution, outerRadius],
  );

  return (
    <View style={styles.breakdownShell}>
      <View style={styles.breakdownChartWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={outerRadius}
            stroke={hexToRgba(theme.colors.border, 0.8)}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {segmentPaths.map((segment, index) => {
            const isSelected = index === selectedIndex;
            const toneColor =
              MOOD_COLORS[moodDistribution[index]?.mood] ||
              theme.colors.primary;

            return (
              <Path
                key={segment.mood}
                d={segment.path}
                fill={toneColor}
                opacity={isSelected ? 1 : 0.7}
                onPress={() => {
                  triggerHaptic('optionSelected').catch(() => undefined);
                  onSelectIndex(index);
                }}
                testID={`breakdown-segment-${index}`}
              />
            );
          })}
        </Svg>

        <View style={styles.breakdownCenterLabel}>
          <Text
            style={[
              styles.breakdownPercent,
              { color: theme.colors.foreground },
            ]}
          >
            {selectedSegment?.percentage || 0}%
          </Text>
          <Text
            style={[
              styles.breakdownCaption,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {selectedSegment?.label || 'No data yet'}
          </Text>
        </View>
      </View>

      <View style={styles.breakdownLegend}>
        {moodDistribution.map((segment, index) => {
          const toneColor = MOOD_COLORS[segment.mood] || theme.colors.primary;

          return (
            <HapticPressable
              key={segment.mood}
              accessibilityRole="button"
              accessibilityLabel={`Select ${segment.label} slice`}
              onPress={() => onSelectIndex(index)}
              style={({ pressed }) => [
                styles.breakdownLegendRow,
                index === selectedIndex && styles.breakdownLegendRowSelected,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.breakdownLegendSwatch,
                  { backgroundColor: toneColor },
                  index === selectedIndex
                    ? styles.breakdownLegendSwatchSelected
                    : styles.breakdownLegendSwatchDefault,
                ]}
              />
              <View style={styles.breakdownLegendCopy}>
                <View style={styles.breakdownLegendTopRow}>
                  <Text
                    style={[
                      styles.breakdownLegendLabel,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {segment.label}
                  </Text>
                  <Text
                    style={[
                      styles.breakdownLegendValue,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {segment.percentage}%
                  </Text>
                </View>
                <View style={styles.breakdownLegendTrack}>
                  <View
                    style={[
                      styles.breakdownLegendFill,
                      {
                        width: `${segment.percentage}%`,
                        backgroundColor: toneColor,
                      },
                    ]}
                  />
                </View>
              </View>
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

function PopularTopicsCard({
  progress,
  topics,
}: {
  progress: Animated.Value;
  topics: InsightsOverview['popularTopics'];
}) {
  const theme = useTheme();

  return (
    <RevealSurface
      progress={progress}
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.summaryTitleRow}>
        <Image source={POPULAR_TOPICS_ICON} style={styles.cardTitleIcon} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Popular Topics
        </Text>
      </View>

      <Text
        style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}
      >
        Top 5 topics used in recent journal entries
      </Text>

      <View style={styles.topicList}>
        {topics.map((topic, index) => (
          <View key={topic.tag} style={styles.topicRow}>
            <Text
              style={[styles.topicLabel, { color: theme.colors.foreground }]}
            >
              {topic.label}
            </Text>
            <View style={styles.topicTrack}>
              <View
                style={[
                  styles.topicFill,
                  {
                    width: `${topic.percentage}%`,
                    backgroundColor: TOPIC_COLORS[index % TOPIC_COLORS.length],
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.topicValue,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {topic.percentage}%
            </Text>
          </View>
        ))}
      </View>
    </RevealSurface>
  );
}

function OverviewSection({
  data,
  isVisible,
  selectedActivityIndex,
  onSelectActivityIndex,
  selectedSegmentIndex,
  onSelectSegmentIndex,
}: {
  data: InsightsOverview;
  isVisible: boolean;
  selectedActivityIndex: number;
  onSelectActivityIndex: (nextIndex: number) => void;
  selectedSegmentIndex: number;
  onSelectSegmentIndex: (nextIndex: number) => void;
}) {
  const theme = useTheme();
  const statsProgress = useRevealProgress(isVisible);
  const activityProgress = useRevealProgress(isVisible);
  const breakdownProgress = useRevealProgress(isVisible);
  const topicsProgress = useRevealProgress(isVisible);

  return (
    <View style={styles.sectionStack}>
      <RevealSurface progress={statsProgress}>
        <View style={styles.statGrid}>
          <StatCardView
            label="Total Entries"
            value={`${data.stats.totalEntries}`}
          />
          <StatCardView
            label="Current Streak"
            value={`${data.stats.currentStreak} days`}
          />
          <StatCardView
            label="Avg Words"
            value={`${data.stats.averageWords}`}
          />
          <StatCardView
            label="Favorites"
            value={`${data.stats.totalFavorites}`}
          />
        </View>
      </RevealSurface>

      <RevealSurface
        progress={activityProgress}
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          7-Day Activity
        </Text>
        <Text
          style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}
        >
          Your writing frequency
        </Text>
        <ActivityChart
          activity={data.activity7d}
          selectedIndex={selectedActivityIndex}
          onSelectIndex={onSelectActivityIndex}
        />
        <View style={styles.chartFooter}>
          <Text
            style={[
              styles.chartFooterLabel,
              { color: theme.colors.mutedForeground },
            ]}
          >
            Selected Day
          </Text>
          <Text
            style={[
              styles.chartFooterValue,
              { color: theme.colors.foreground },
            ]}
          >
            {data.activity7d[selectedActivityIndex]?.label || '--'} •{' '}
            {data.activity7d[selectedActivityIndex]?.count || 0} journaling
            sessions
          </Text>
        </View>
      </RevealSurface>

      <RevealSurface
        progress={breakdownProgress}
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.summaryTitleRow}>
          <Image source={MOOD_DISTRIBUTION_ICON} style={styles.cardTitleIcon} />
          <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
            Mood Distribution
          </Text>
        </View>
        <Text
          style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}
        >
          Mood percentages from recent home check-ins and journal entries
        </Text>
        <BreakdownChart
          moodDistribution={data.moodDistribution}
          selectedIndex={selectedSegmentIndex}
          onSelectIndex={onSelectSegmentIndex}
        />
      </RevealSurface>

      <PopularTopicsCard
        progress={topicsProgress}
        topics={data.popularTopics}
      />
    </View>
  );
}

// Calm progressive-disclosure row: a tappable header with a short preview that
// expands to the full detail. Keeps the analysis surface light while letting a
// curious user go deeper.
function ExpandableRow({
  title,
  preview,
  tone,
  defaultOpen = false,
  children,
}: {
  title: string;
  preview?: string;
  tone?: InsightTone;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const accent = tone ? getToneColor(tone) : theme.colors.primary;

  return (
    <View
      style={[
        styles.expandableRow,
        {
          backgroundColor: hexToRgba(accent, 0.06),
          borderColor: hexToRgba(accent, 0.16),
        },
      ]}
    >
      <HapticPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => setOpen(value => !value)}
        style={styles.expandableHeader}
      >
        <View style={styles.expandableHeaderText}>
          <Text
            style={[styles.expandableTitle, { color: theme.colors.foreground }]}
          >
            {title}
          </Text>
          {!open && preview ? (
            <Text
              numberOfLines={2}
              style={[
                styles.expandablePreview,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {preview}
            </Text>
          ) : null}
        </View>
        <ChevronDown
          color={theme.colors.mutedForeground}
          size={18}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </HapticPressable>
      {open ? <View style={styles.expandableBody}>{children}</View> : null}
    </View>
  );
}

// The intriguing hook: the behaviour↔trigger patterns the week surfaced, each a
// tap-to-open row revealing the user's own evidence and one gentle nudge.
function PatternsCard({ analysis }: { analysis: InsightsAiAnalysisReady }) {
  const theme = useTheme();
  const hasPatterns = Boolean(analysis.patterns?.length);

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.summaryTitleRow}>
        <Image source={PATTERNS_DISCOVERED_ICON} style={styles.cardTitleIcon} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Patterns Discovered
        </Text>
      </View>

      {!hasPatterns ? (
        <Text
          style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}
        >
          No clear patterns yet this week.
        </Text>
      ) : (
      <View style={styles.expandableStack}>
        {analysis.patterns.map((pattern, index) => {
          const toneColor = getToneColor(pattern.tone);

          return (
            <ExpandableRow
              key={`${pattern.label}-${index}`}
              title={pattern.label}
              preview={pattern.insight}
              tone={pattern.tone}
              defaultOpen={index === 0}
            >
              <Text
                style={[
                  styles.patternInsightText,
                  { color: theme.colors.foreground },
                ]}
              >
                {pattern.insight}
              </Text>
              {pattern.evidence.length ? (
                <View style={styles.traitEvidenceRow}>
                  {pattern.evidence.slice(0, 3).map(evidence => (
                    <View
                      key={`${pattern.label}-${evidence}`}
                      style={[
                        styles.traitEvidencePill,
                        { backgroundColor: hexToRgba(toneColor, 0.14) },
                      ]}
                    >
                      <Text
                        style={[styles.traitEvidenceText, { color: toneColor }]}
                      >
                        {evidence}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View
                style={[
                  styles.patternNudge,
                  { backgroundColor: hexToRgba(theme.colors.primary, 0.06) },
                ]}
              >
                <Text
                  style={[
                    styles.patternNudgeLabel,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Try this
                </Text>
                <Text
                  style={[
                    styles.patternNudgeText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {pattern.nudge}
                </Text>
              </View>
            </ExpandableRow>
          );
        })}
      </View>
      )}
    </View>
  );
}


function AnalysisHeroCard({ analysis }: { analysis: InsightsAiAnalysisReady }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.summaryTitleRow}>
        <Image source={WEEKLY_ANALYSIS_ICON} style={styles.cardTitleIcon} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Weekly AI Analysis
        </Text>
      </View>

      <Text
        style={[styles.analysisHeadline, { color: theme.colors.foreground }]}
      >
        {analysis.summary.headline}
      </Text>

      <View style={styles.analysisContentStack}>
        <Text style={[styles.summaryBody, { color: theme.colors.foreground }]}>
          {analysis.summary.narrative}
        </Text>
      </View>
    </View>
  );
}

function TopicSnapshotCard({
  analysis,
}: {
  analysis: InsightsAiAnalysisReady;
}) {
  const theme = useTheme();
  const hasTopics = Boolean(analysis.themeBreakdown.items.length);

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.summaryTitleRow}>
        <Image source={TOPIC_SNAPSHOT_ICON} style={styles.cardTitleIcon} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Topic Snapshot
        </Text>
      </View>

      {!hasTopics ? (
        <Text
          style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}
        >
          No standout topics yet this week.
        </Text>
      ) : (
      <View style={styles.activityColumnChart}>
        {analysis.themeBreakdown.items.map(item => {
          const barHeight = Math.max(24, (item.percentage / 100) * 150);
          const toneColor = getToneColor(item.tone);

          return (
            <View key={item.label} style={styles.activityColumn}>
              <View
                style={[
                  styles.activityColumnTrack,
                  { backgroundColor: hexToRgba(toneColor, 0.12) },
                ]}
              >
                <View
                  style={[
                    styles.activityColumnFill,
                    {
                      height: barHeight,
                      backgroundColor: toneColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.topicMeterValue,
                  { color: theme.colors.foreground },
                ]}
              >
                {item.percentage}%
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.axisLabel,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
      )}
    </View>
  );
}

function ActionPlanCard({ analysis }: { analysis: InsightsAiAnalysisReady }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.summaryTitleRow}>
        <Image source={ACTIONABLE_STEPS_ICON} style={styles.cardTitleIcon} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Actionable Steps
        </Text>
      </View>
      <Text
        style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}
      >
        {truncateWords(analysis.actionPlan.headline, 12)}
      </Text>

      <View style={styles.actionList}>
        {analysis.actionPlan.steps.slice(0, 2).map((step, index) => (
          <View
            key={step.title}
            style={[
              styles.actionRow,
              { backgroundColor: hexToRgba(theme.colors.primary, 0.05) },
            ]}
          >
            <View
              style={[
                styles.actionIndexBadge,
                { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
              ]}
            >
              <Text
                style={[
                  styles.actionIndexText,
                  { color: theme.colors.primary },
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <View style={styles.actionCopy}>
              <View style={styles.actionHeaderRow}>
                <Text
                  style={[
                    styles.patternTitle,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {step.title}
                </Text>
              </View>
              <Text
                style={[
                  styles.patternSubtitle,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {step.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AnalysisSection({
  analysis,
}: {
  analysis: InsightsAiAnalysisReady;
}) {
  return (
    <View style={styles.sectionStack}>
      <AnalysisHeroCard analysis={analysis} />
      <TopicSnapshotCard analysis={analysis} />
      <PatternsCard analysis={analysis} />
      <ActionPlanCard analysis={analysis} />
    </View>
  );
}

function ErrorState({
  onRetry,
  title = 'Unable to load insights',
  message = 'We could not fetch your latest insights right now.',
}: {
  onRetry: () => void;
  title?: string;
  message?: string;
}) {
  const theme = useTheme();

  return (
    <SectionCard>
      <View style={styles.emptyState}>
        <AlertCircle color={theme.colors.destructive} size={24} />
        <Text
          style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.emptyStateText,
            { color: theme.colors.mutedForeground },
          ]}
        >
          {message}
        </Text>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Retry insights"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <RefreshCw color={theme.colors.primaryForeground} size={14} />
          <Text
            style={[
              styles.retryButtonText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            Retry
          </Text>
        </HapticPressable>
      </View>
    </SectionCard>
  );
}

function LoadingState() {
  const theme = useTheme();

  return (
    <SectionCard>
      <View style={styles.emptyState}>
        <JournalLoader color={theme.colors.primary} />
        <Text
          style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}
        >
          Loading insights
        </Text>
        <Text
          style={[
            styles.emptyStateText,
            { color: theme.colors.mutedForeground },
          ]}
        >
          Pulling your latest journaling trends from the app database.
        </Text>
      </View>
    </SectionCard>
  );
}

function LockedAiAnalysisCard({
  onOpenSubscription,
}: {
  onOpenSubscription: () => void;
}) {
  const theme = useTheme();

  return (
    <SectionCard>
      <View style={styles.lockedState}>
        <Text
          style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}
        >
          AI Analysis is a premium feature
        </Text>
        <Text
          style={[
            styles.emptyStateText,
            { color: theme.colors.mutedForeground },
          ]}
        >
          Upgrade to unlock weekly behavior analysis, trait signals, supportive
          watchpoints, and guided next steps.
        </Text>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Upgrade to unlock"
          onPress={onOpenSubscription}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Image
            source={PREMIUM_LOCK_ICON}
            style={styles.retryButtonLockIcon}
          />
          <Text
            style={[
              styles.retryButtonText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            Upgrade to unlock
          </Text>
        </HapticPressable>
      </View>
    </SectionCard>
  );
}

function WeeklyProgressCard({
  activeDays,
  minimumActiveDays,
}: {
  activeDays: number;
  minimumActiveDays: number;
}) {
  const theme = useTheme();
  const progressRatio =
    minimumActiveDays > 0
      ? Math.max(0, Math.min(1, activeDays / minimumActiveDays))
      : 0;

  return (
    <SectionCard>
      <View style={styles.summaryTitleRow}>
        <Image source={WEEKLY_PROGRESS_ICON} style={styles.cardTitleIcon} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Weekly AI Analysis
        </Text>
      </View>
      <Text
        style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}
      >
        Log a few entries this week to unlock your AI behavior analysis.
      </Text>
      <View style={styles.weeklyProgressRow}>
        <View
          style={[
            styles.weeklyProgressTrack,
            { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
          ]}
        >
          <View
            style={[
              styles.weeklyProgressFill,
              {
                width: `${progressRatio * 100}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.weeklyProgressCount,
            { color: theme.colors.foreground },
          ]}
        >
          {activeDays}/{minimumActiveDays}
        </Text>
      </View>
    </SectionCard>
  );
}

function AnalysisLoadingState() {
  const theme = useTheme();

  return (
    <SectionCard>
      <View style={styles.emptyState}>
        <JournalLoader color={theme.colors.primary} />
        <Text
          style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}
        >
          Loading AI analysis
        </Text>
        <Text
          style={[
            styles.emptyStateText,
            { color: theme.colors.mutedForeground },
          ]}
        >
          Building your weekly behavior read from recent entries and mood
          check-ins.
        </Text>
      </View>
    </SectionCard>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const stage = useAppStore(state => state.stage);
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const preferredInsightsTab = useAppStore(state => state.preferredInsightsTab);
  const clearPreferredInsightsTab = useAppStore(
    state => state.clearPreferredInsightsTab,
  );
  const [activeTab, setActiveTab] = useState<InsightTab>(
    () => useAppStore.getState().preferredInsightsTab || 'overview',
  );
  const [selectedActivityIndex, setSelectedActivityIndex] = useState(3);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const [data, setData] = useState<InsightsOverview | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<InsightsAiAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const thumbX = useRef(new Animated.Value(0)).current;
  const contentProgress = useRef(new Animated.Value(1)).current;
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const horizontalPadding = useMemo(
    () => Math.max(16, Math.min(24, width * 0.05)),
    [width],
  );
  const layoutMaxWidth = width >= 430 ? 470 : 430;
  const thumbWidth = segmentedWidth > 0 ? (segmentedWidth - 6 - 4) / 2 : 0;
  const readyAnalysis = aiAnalysis?.status === 'ready' ? aiAnalysis : null;
  const collectingAnalysis =
    aiAnalysis?.status === 'collecting' ? aiAnalysis : null;
  const insufficientAnalysis =
    aiAnalysis?.status === 'insufficient' ? aiAnalysis : null;

  const loadInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextData = await getInsightsOverview();
      setData(nextData);
      setSelectedActivityIndex(
        nextData.activity7d.length
          ? Math.min(3, nextData.activity7d.length - 1)
          : 0,
      );
      setSelectedSegmentIndex(0);
      setAnalysisError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load insights right now.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadAiAnalysis = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!isPremiumUser) {
        return;
      }

      if (!force && aiAnalysis) {
        return;
      }

      setIsAnalysisLoading(true);
      setAnalysisError(null);

      try {
        const nextAnalysis = await getInsightsAiAnalysis();
        setAiAnalysis(nextAnalysis);
        await syncWeeklyInsightNotifications(
          nextAnalysis.status === 'collecting' ? nextAnalysis : null,
        );
      } catch (loadError) {
        setAnalysisError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load AI analysis right now.',
        );
        cancelWeeklyInsightNotifications().catch(() => undefined);
      } finally {
        setIsAnalysisLoading(false);
      }
    },
    [aiAnalysis, isPremiumUser],
  );

  // Free users are allowed onto the analysis tab. Opening the paywall from here
  // meant they never saw what they were being asked to pay for — and because the
  // swipe handler routes through this function too, a stray swipe fired it. The
  // gate is now `LockedAiAnalysisCard`, rendered in place of the analysis, and
  // the fetch stays premium-only.
  const handleSelectTab = useCallback((nextTab: InsightTab) => {
    setActiveTab(nextTab);
  }, []);

  const handleSwipeStart = useCallback((event: SwipeTouchEvent) => {
    swipeStartRef.current = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };
  }, []);

  const handleSwipeEnd = useCallback(
    (event: SwipeTouchEvent) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;

      if (!start) {
        return;
      }

      const dx = event.nativeEvent.locationX - start.x;
      const dy = event.nativeEvent.locationY - start.y;
      const isHorizontalSwipe =
        Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy);

      if (!isHorizontalSwipe) {
        return;
      }

      if (dx < 0 && activeTab === 'overview') {
        triggerHaptic('optionSelected').catch(() => undefined);
        handleSelectTab('analysis');
        return;
      }

      if (dx > 0 && activeTab === 'analysis') {
        triggerHaptic('optionSelected').catch(() => undefined);
        handleSelectTab('overview');
      }
    },
    [activeTab, handleSelectTab],
  );

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getInsightsOverview()
      .then(nextData => {
        if (cancelled) {
          return;
        }

        setData(nextData);
        setSelectedActivityIndex(
          nextData.activity7d.length
            ? Math.min(3, nextData.activity7d.length - 1)
            : 0,
        );
        setSelectedSegmentIndex(0);
        setAnalysisError(null);
      })
      .catch(loadError => {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load insights right now.',
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPremiumUser || activeTab !== 'analysis') {
      return;
    }

    loadAiAnalysis().catch(() => undefined);
  }, [activeTab, isPremiumUser, loadAiAnalysis]);

  // A free user reaching the tab is the same intent signal the tap used to
  // carry, so the event still fires — it just no longer drags a paywall with it.
  useEffect(() => {
    if (isPremiumUser || activeTab !== 'analysis') {
      return;
    }

    trackPaywallEvent({
      placementKey: 'insights_ai_tab_locked',
      screenKey: 'insights',
      eventType: 'locked_feature_tap',
      wasInterruptive: false,
    }).catch(() => undefined);
  }, [activeTab, isPremiumUser]);

  useEffect(() => {
    if (isPremiumUser || stage !== 'main-app') {
      return;
    }

    let cancelled = false;

    getPaywallConfig({
      placementKey: 'insights_interruptive',
      screenKey: 'insights',
      currentStage: stage,
      triggerMode: 'interruptive',
    })
      .then(result => {
        if (cancelled || !result.shouldShow) {
          return;
        }

        openPaywallForPlacement({
          placementKey: result.placementKey,
          returnStage: 'main-app',
          screenKey: result.screenKey || 'insights',
          triggerMode: 'interruptive',
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isPremiumUser, openPaywallForPlacement, stage]);

  useEffect(() => {
    const initialPreferredTab = useAppStore.getState().preferredInsightsTab;

    if (!initialPreferredTab) {
      return;
    }

    setActiveTab(initialPreferredTab);
    clearPreferredInsightsTab();
  }, [clearPreferredInsightsTab]);

  useEffect(() => {
    if (!preferredInsightsTab) {
      return;
    }

    setActiveTab(preferredInsightsTab);
    clearPreferredInsightsTab();
  }, [clearPreferredInsightsTab, preferredInsightsTab]);

  useEffect(() => {
    if (!segmentedWidth || !thumbWidth) {
      return;
    }

    Animated.timing(thumbX, {
      toValue: activeTab === 'overview' ? 0 : thumbWidth + 4,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, segmentedWidth, thumbWidth, thumbX]);

  useEffect(() => {
    contentProgress.stopAnimation();
    contentProgress.setValue(0);

    Animated.timing(contentProgress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, contentProgress]);

  return (
    <TabScreenLayout
      backgroundColor={theme.colors.background}
      horizontalPadding={horizontalPadding}
      layoutMaxWidth={layoutMaxWidth}
      scrollContentStyle={styles.scrollContent}
      shellStyle={styles.shell}
    >
      <View style={styles.pageShell}>
        <Header />

        <View
          style={[
            styles.segmentedControl,
            {
              backgroundColor: theme.colors.secondary,
              borderColor: theme.colors.border,
            },
          ]}
          onLayout={(event: {
            nativeEvent: { layout: { width: number; height: number } };
          }) => {
            setSegmentedWidth(event.nativeEvent.layout.width);
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentThumb,
              {
                backgroundColor: theme.colors.card,
                width: thumbWidth || 0,
                transform: [{ translateX: thumbX }],
              },
            ]}
          />
          <TabPill
            theme={theme}
            label="Overview"
            selected={activeTab === 'overview'}
            onPress={() => handleSelectTab('overview')}
          />
          <TabPill
            theme={theme}
            label="AI Analysis"
            selected={activeTab === 'analysis'}
            image={AI_ANALYSIS_TAB_ICON}
            onPress={() => handleSelectTab('analysis')}
          />
        </View>

        {isLoading ? (
          <LoadingState />
        ) : error || !data ? (
          <ErrorState
            onRetry={() => {
              loadInsights().catch(() => undefined);
            }}
          />
        ) : (
          <View
            testID="insights-view-swipe-zone"
            style={styles.swipeZone}
            onTouchStart={handleSwipeStart}
            onTouchEnd={handleSwipeEnd}
          >
            <Animated.View
              style={[
                styles.sectionTransition,
                {
                  opacity: contentProgress,
                  transform: [
                    {
                      translateY: contentProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {activeTab === 'overview' ? (
                <OverviewSection
                  data={data}
                  isVisible={activeTab === 'overview'}
                  selectedActivityIndex={selectedActivityIndex}
                  onSelectActivityIndex={setSelectedActivityIndex}
                  selectedSegmentIndex={selectedSegmentIndex}
                  onSelectSegmentIndex={setSelectedSegmentIndex}
                />
              ) : !isPremiumUser ? (
                <LockedAiAnalysisCard
                  onOpenSubscription={() => {
                    trackPaywallEvent({
                      placementKey: 'insights_ai_tab_locked',
                      screenKey: 'insights',
                      eventType: 'locked_feature_tap',
                      wasInterruptive: false,
                    }).catch(() => undefined);
                    openPaywallForPlacement({
                      placementKey: 'insights_ai_tab_locked',
                      returnStage: 'main-app',
                      screenKey: 'insights',
                    });
                  }}
                />
              ) : isAnalysisLoading ? (
                <AnalysisLoadingState />
              ) : analysisError || !aiAnalysis ? (
                <ErrorState
                  title="Unable to load AI analysis"
                  message="We could not build your weekly AI analysis right now."
                  onRetry={() => {
                    loadAiAnalysis({ force: true }).catch(() => undefined);
                  }}
                />
              ) : collectingAnalysis ? (
                <WeeklyProgressCard
                  activeDays={collectingAnalysis.progress.activeDays}
                  minimumActiveDays={
                    collectingAnalysis.progress.minimumActiveDays
                  }
                />
              ) : insufficientAnalysis ? (
                <WeeklyProgressCard
                  activeDays={insufficientAnalysis.progress.activeDays}
                  minimumActiveDays={
                    insufficientAnalysis.progress.minimumActiveDays
                  }
                />
              ) : readyAnalysis ? (
                <AnalysisSection analysis={readyAnalysis!} />
              ) : (
                <ErrorState
                  title="AI analysis unavailable"
                  message="The latest AI analysis wasn't ready yet. Please try again in a moment."
                  onRetry={() => {
                    loadAiAnalysis({ force: true }).catch(() => undefined);
                  }}
                />
              )}
            </Animated.View>
          </View>
        )}
      </View>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
  },
  shell: {
    paddingBottom: 12,
  },
  pageShell: {
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 2,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  headerCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  segmentedControl: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 3,
    gap: 4,
    overflow: 'hidden',
  },
  segmentThumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 14,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },
  tabPill: {
    minHeight: 32,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabPillLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  tabPillLabelSelected: {
    fontWeight: '700',
  },
  tabPillLabelDefault: {
    fontWeight: '600',
  },
  tabPillImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  sectionStack: {
    gap: 14,
  },
  expandableStack: {
    marginTop: 12,
    gap: 8,
  },
  expandableRow: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  expandableHeaderText: {
    flex: 1,
    gap: 4,
  },
  expandableTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  expandablePreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  expandableBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  patternInsightText: {
    fontSize: 14,
    lineHeight: 20,
  },
  patternNudge: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  patternNudgeLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  patternNudgeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTransition: {
    width: '100%',
  },
  swipeZone: {
    width: '100%',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 138,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'space-between',
    minHeight: 92,
  },
  statLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  yLabels: {
    width: 18,
    height: 172,
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 28,
  },
  axisLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  axisLabelSelected: {
    fontWeight: '700',
  },
  axisLabelDefault: {
    fontWeight: '400',
  },
  chartBody: {
    position: 'relative',
  },
  chartSvg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chartHitArea: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  chartLabelsRow: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 34,
    right: 12,
    paddingTop: 6,
  },
  chartFooter: {
    marginTop: 10,
    paddingHorizontal: 2,
    gap: 2,
  },
  chartFooterLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  chartFooterValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  breakdownShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  breakdownChartWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownPercent: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  breakdownCaption: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  breakdownLegend: {
    flex: 1,
    gap: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  breakdownLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  breakdownLegendRowSelected: {
    opacity: 1,
  },
  breakdownLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLegendSwatchSelected: {
    opacity: 1,
  },
  breakdownLegendSwatchDefault: {
    opacity: 0.72,
  },
  breakdownLegendLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  breakdownLegendValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  breakdownLegendCopy: {
    flex: 1,
    gap: 5,
  },
  breakdownLegendTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  breakdownLegendTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(131, 125, 119, 0.16)',
  },
  breakdownLegendFill: {
    height: '100%',
    borderRadius: 999,
  },
  topicList: {
    gap: 18,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 30,
  },
  topicMeterValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  topicLabel: {
    fontSize: 14,
    lineHeight: 19,
    width: 126,
    flexShrink: 0,
    fontWeight: '600',
  },
  topicValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    width: 32,
    flexShrink: 0,
    textAlign: 'right',
  },
  topicTrack: {
    width: 154,
    flexShrink: 0,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(131, 125, 119, 0.16)',
    overflow: 'hidden',
  },
  topicFill: {
    height: '100%',
    borderRadius: 999,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitleIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  summaryBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  analysisHeadline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  analysisContentStack: {
    gap: 12,
    marginBottom: 14,
  },
  activityColumnChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    height: 184,
    marginTop: 6,
    marginBottom: 12,
  },
  activityColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  activityColumnTrack: {
    width: '100%',
    minWidth: 24,
    maxWidth: 34,
    height: 150,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  activityColumnFill: {
    width: '100%',
    borderRadius: 999,
    minHeight: 14,
  },
  patternTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  patternTagPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  patternTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  keyInsightCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  traitList: {
    gap: 12,
  },
  traitCard: {
    gap: 8,
    paddingBottom: 2,
  },
  traitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  traitLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    flex: 1,
  },
  traitBandPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  traitBandText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  traitTrack: {
    width: '100%',
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  traitFill: {
    height: '100%',
    borderRadius: 999,
  },
  traitScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  traitScoreText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  traitSupportText: {
    fontSize: 11,
    lineHeight: 14,
  },
  traitEvidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  traitEvidencePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  traitEvidenceText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  promptList: {
    gap: 10,
    marginTop: 2,
  },
  promptTopicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  promptTopicPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  promptTopicPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  promptTopicLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  promptCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  promptItemText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  patternList: {
    gap: 14,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  patternIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  patternCopy: {
    flex: 1,
  },
  patternTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: 2,
  },
  patternSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  signalCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  watchpointList: {
    gap: 12,
  },
  watchpointCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  watchpointHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  watchpointTitleWrap: {
    flex: 1,
  },
  watchpointTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  watchpointSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  watchpointTipCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  watchpointTipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionList: {
    gap: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  actionIndexText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  actionCopy: {
    flex: 1,
    gap: 4,
  },
  actionHeaderRow: {
    gap: 2,
  },
  appSupportList: {
    gap: 10,
  },
  appSupportCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  lockedState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  retryButtonLockIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  weeklyProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  weeklyProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  weeklyProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  weeklyProgressCount: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
});
