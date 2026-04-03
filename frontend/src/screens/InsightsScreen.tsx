import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from "react-native-svg";
import {
  AlertCircle,
  Award,
  Brain,
  Leaf,
  Lock,
  PieChart,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import TabScreenLayout from "../components/TabScreenLayout";
import {
  getInsightsAiAnalysis,
  getInsightsOverview,
  type InsightTone,
  type InsightsAiAnalysis,
  type InsightsOverview,
} from "../services/insightsService";
import { useAppStore } from "../store/appStore";
import { useTheme } from "../theme/provider";

type InsightTab = "overview" | "analysis";

const MOOD_COLORS: Record<string, string> = {
  amazing: "#E6816D",
  good: "#7D9FD6",
  okay: "#E9A15B",
  bad: "#8E939A",
  terrible: "#D26A6A",
};

const TOPIC_COLORS = ["#E6816D", "#7D9FD6", "#8AB39A", "#E9A15B", "#A47BD6"];
const TRAIT_BAR_COLORS = ["#E6816D", "#7D9FD6", "#8AB39A", "#E9A15B", "#A47BD6"];

const WATCHPOINT_COLORS = {
  low: "#8AB39A",
  watch: "#E9A15B",
  elevated: "#D26A6A",
} as const;

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

function getToneColor(tone: InsightTone) {
  switch (tone) {
    case "coral":
      return "#E6816D";
    case "blue":
      return "#7D9FD6";
    case "sage":
      return "#8AB39A";
    case "amber":
      return "#E9A15B";
    case "slate":
    default:
      return "#8E939A";
  }
}

function getFirstSentence(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^[^.?!]+[.?!]?/);
  return (match?.[0] || normalized).trim();
}

function truncateWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return text.trim();
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
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

function SectionCard({
  children,
}: {
  children: ReactNode;
}) {
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
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  label: string;
  selected: boolean;
  icon?: typeof Sparkles;
  onPress: () => void;
}) {
  const Icon = icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        {
          backgroundColor: selected ? theme.colors.card : "transparent",
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
      ) : null}
    </Pressable>
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
        <Sparkles color={theme.colors.primary} size={22} />
      </View>

      <View style={styles.headerCopy}>
        <Text style={[styles.pageTitle, { color: theme.colors.foreground }]}>
          Insights
        </Text>
        <Text style={[styles.pageSubtitle, { color: theme.colors.mutedForeground }]}>
          Your journaling patterns & growth
        </Text>
      </View>
    </View>
  );
}

function StatCardView({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${paddingLeft + plotWidth} ${paddingTop + plotHeight} L ${paddingLeft} ${paddingTop + plotHeight} Z`;

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
  angleInDegrees: number
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
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function buildDonutSegments({
  segments,
  center,
  outerRadius,
  innerRadius,
}: {
  segments: InsightsOverview["moodDistribution"];
  center: number;
  outerRadius: number;
  innerRadius: number;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.percentage, 0)
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
  activity: InsightsOverview["activity7d"];
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
    [activity]
  );
  const fillColor = hexToRgba(theme.colors.primary, 0.12);
  const mutedLineColor = hexToRgba(theme.colors.secondaryForeground, 0.52);

  return (
    <View style={styles.chartWrap}>
      <View style={styles.yLabels}>
        {["4", "3", "2", "1", "0"].map(label => (
          <Text key={label} style={[styles.axisLabel, { color: theme.colors.mutedForeground }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={[styles.chartBody, { width: chartWidth, height: chartHeight }]}>
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
                fill={index === selectedIndex ? theme.colors.primary : theme.colors.card}
                stroke={index === selectedIndex ? theme.colors.primary : mutedLineColor}
                strokeWidth={2}
              />
              <Circle
                cx={point.x}
                cy={point.y}
                r={index === selectedIndex ? 8 : 7}
                fill={
                  index === selectedIndex ? hexToRgba(theme.colors.primary, 0.12) : "transparent"
                }
              />
            </G>
          ))}
        </Svg>

        <View style={styles.chartOverlay}>
          {chartGeometry.points.map((point, index) => (
            <Pressable
              key={`hit-${activity[index].dateKey}`}
              accessibilityRole="button"
              accessibilityLabel={`Select ${activity[index].label} activity`}
              testID={`activity-point-${index}`}
              onPress={() => onSelectIndex(index)}
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
                index === selectedIndex ? styles.axisLabelSelected : styles.axisLabelDefault,
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
  moodDistribution: InsightsOverview["moodDistribution"];
  selectedIndex: number;
  onSelectIndex: (nextIndex: number) => void;
}) {
  const theme = useTheme();
  const size = 150;
  const strokeWidth = 18;
  const outerRadius = (size - strokeWidth) / 2;
  const innerRadius = outerRadius - strokeWidth;
  const center = size / 2;
  const selectedSegment = moodDistribution[selectedIndex] || moodDistribution[0];
  const segmentPaths = useMemo(
    () =>
      buildDonutSegments({
        segments: moodDistribution,
        center,
        outerRadius,
        innerRadius,
      }),
    [center, innerRadius, moodDistribution, outerRadius]
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
              MOOD_COLORS[moodDistribution[index]?.mood] || theme.colors.primary;

            return (
              <Path
                key={segment.mood}
                d={segment.path}
                fill={toneColor}
                opacity={isSelected ? 1 : 0.7}
                onPress={() => onSelectIndex(index)}
                testID={`breakdown-segment-${index}`}
              />
            );
          })}
        </Svg>

        <View style={styles.breakdownCenterLabel}>
          <Text style={[styles.breakdownPercent, { color: theme.colors.foreground }]}>
            {selectedSegment?.percentage || 0}%
          </Text>
          <Text style={[styles.breakdownCaption, { color: theme.colors.mutedForeground }]}>
            {selectedSegment?.label || "No data yet"}
          </Text>
        </View>
      </View>

      <View style={styles.breakdownLegend}>
        {moodDistribution.map((segment, index) => {
          const toneColor = MOOD_COLORS[segment.mood] || theme.colors.primary;

          return (
            <Pressable
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
                  <Text style={[styles.breakdownLegendLabel, { color: theme.colors.foreground }]}>
                    {segment.label}
                  </Text>
                  <Text
                    style={[styles.breakdownLegendValue, { color: theme.colors.mutedForeground }]}
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
            </Pressable>
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
  topics: InsightsOverview["popularTopics"];
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
        <Leaf color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Popular Topics
        </Text>
      </View>

      <Text style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}>
        Top 5 topics used in recent journal entries
      </Text>

      <View style={styles.topicList}>
        {topics.map((topic, index) => (
          <View key={topic.tag} style={styles.topicRow}>
            <Text style={[styles.topicLabel, { color: theme.colors.foreground }]}>
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
            <Text style={[styles.topicValue, { color: theme.colors.mutedForeground }]}>
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
          <StatCardView label="Total Entries" value={`${data.stats.totalEntries}`} />
          <StatCardView label="Current Streak" value={`${data.stats.currentStreak} days`} />
          <StatCardView label="Avg Words" value={`${data.stats.averageWords}`} />
          <StatCardView label="Favorites" value={`${data.stats.totalFavorites}`} />
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
        <Text style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}>
          Your writing frequency
        </Text>
        <ActivityChart
          activity={data.activity7d}
          selectedIndex={selectedActivityIndex}
          onSelectIndex={onSelectActivityIndex}
        />
        <View style={styles.chartFooter}>
          <Text style={[styles.chartFooterLabel, { color: theme.colors.mutedForeground }]}>
            Selected Day
          </Text>
          <Text style={[styles.chartFooterValue, { color: theme.colors.foreground }]}>
            {data.activity7d[selectedActivityIndex]?.label || "--"} •{" "}
            {data.activity7d[selectedActivityIndex]?.count || 0} journaling sessions
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
          <PieChart color={theme.colors.primary} size={18} />
          <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
            Mood Distribution
          </Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}>
          Mood percentages from recent home check-ins and journal entries
        </Text>
        <BreakdownChart
          moodDistribution={data.moodDistribution}
          selectedIndex={selectedSegmentIndex}
          onSelectIndex={onSelectSegmentIndex}
        />
      </RevealSurface>

      <PopularTopicsCard progress={topicsProgress} topics={data.popularTopics} />
    </View>
  );
}

function AnalysisHeroCard({
  analysis,
}: {
  analysis: InsightsAiAnalysis;
}) {
  const theme = useTheme();
  const conciseHighlight = truncateWords(analysis.summary.highlight, 18);

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
        <Brain color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Weekly Analysis
        </Text>
      </View>

      <View style={styles.analysisMetaRow}>
        <View
          style={[
            styles.analysisMetaPill,
            { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
          ]}
        >
          <Text style={[styles.analysisMetaPillText, { color: theme.colors.primary }]}>
            {analysis.window.label}
          </Text>
        </View>
        <View
          style={[
            styles.analysisMetaPill,
            { backgroundColor: hexToRgba(theme.colors.secondaryForeground, 0.08) },
          ]}
        >
          <Text style={[styles.analysisMetaText, { color: theme.colors.mutedForeground }]}>
            {analysis.freshness.confidenceLabel}
          </Text>
        </View>
      </View>

      <Text style={[styles.analysisHeadline, { color: theme.colors.foreground }]}>
        {analysis.summary.headline}
      </Text>

      <View style={styles.analysisContentStack}>
        <Text style={[styles.summaryBody, { color: theme.colors.foreground }]}>
          {getFirstSentence(analysis.summary.narrative)}
        </Text>

        <View
          style={[
            styles.analysisHeroCard,
            {
              backgroundColor: hexToRgba(theme.colors.primary, 0.08),
            },
          ]}
        >
          <Text style={[styles.keyInsightLabel, { color: theme.colors.mutedForeground }]}>
            Key Insight
          </Text>
          <Text style={[styles.keyInsightText, { color: theme.colors.foreground }]}>
            {conciseHighlight}
          </Text>
        </View>
      </View>

      <View style={styles.analysisStatsRow}>
        <View
          style={[
            styles.analysisStatCard,
            { backgroundColor: hexToRgba(theme.colors.secondaryForeground, 0.06) },
          ]}
        >
          <Text style={[styles.analysisStatValue, { color: theme.colors.foreground }]}>
            {analysis.window.entryCount}
          </Text>
          <Text style={[styles.analysisStatLabel, { color: theme.colors.mutedForeground }]}>
            entries
          </Text>
        </View>
        <View
          style={[
            styles.analysisStatCard,
            { backgroundColor: hexToRgba(theme.colors.secondaryForeground, 0.06) },
          ]}
        >
          <Text style={[styles.analysisStatValue, { color: theme.colors.foreground }]}>
            {analysis.window.activeDays}
          </Text>
          <Text style={[styles.analysisStatLabel, { color: theme.colors.mutedForeground }]}>
            active days
          </Text>
        </View>
      </View>

      <Text style={[styles.analysisSupportCopy, { color: theme.colors.mutedForeground }]}>
        {analysis.freshness.note}
      </Text>

      <View style={styles.patternTagRow}>
        {analysis.patternTags.slice(0, 3).map(tag => {
          const toneColor = getToneColor(tag.tone);

          return (
            <View
              key={tag.label}
              style={[
                styles.patternTagPill,
                { backgroundColor: hexToRgba(toneColor, 0.12) },
              ]}
            >
              <Text style={[styles.patternTagText, { color: toneColor }]}>
                {tag.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PersonalityTraitsCard({
  analysis,
}: {
  analysis: InsightsAiAnalysis;
}) {
  const theme = useTheme();
  const topTraits = [...analysis.bigFive]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

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
        <TrendingUp color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Big Five Signals
        </Text>
      </View>
      <Text style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}>
        Top weekly trait signals from recent writing language.
      </Text>

      <View style={styles.traitList}>
        {topTraits.map((item, index) => {
          const toneColor = TRAIT_BAR_COLORS[index % TRAIT_BAR_COLORS.length];

          return (
            <View key={item.trait} style={styles.traitCard}>
              <View style={styles.traitHeaderRow}>
                <Text style={[styles.traitLabel, { color: theme.colors.foreground }]}>
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.traitBandPill,
                    { backgroundColor: hexToRgba(toneColor, 0.12) },
                  ]}
                >
                  <Text style={[styles.traitBandText, { color: toneColor }]}>
                    {item.band}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.traitTrack,
                  { backgroundColor: hexToRgba(toneColor, 0.12) },
                ]}
              >
                <View
                  style={[
                    styles.traitFill,
                    {
                      width: `${item.score}%`,
                      backgroundColor: toneColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.traitScoreRow}>
                <Text style={[styles.traitScoreText, { color: theme.colors.foreground }]}>
                  {item.score}
                </Text>
                <Text style={[styles.traitSupportText, { color: theme.colors.mutedForeground }]}>
                  /100 weekly signal
                </Text>
              </View>
              <Text style={[styles.patternSubtitle, { color: theme.colors.mutedForeground }]}>
                {getFirstSentence(item.description)}
              </Text>
              <View style={styles.traitEvidenceRow}>
                {item.evidenceTags.slice(0, 2).map(tag => (
                  <View
                    key={`${item.trait}-${tag}`}
                    style={[
                      styles.traitEvidencePill,
                      { backgroundColor: hexToRgba(theme.colors.secondaryForeground, 0.08) },
                    ]}
                  >
                    <Text
                      style={[styles.traitEvidenceText, { color: theme.colors.mutedForeground }]}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WatchpointsCard({
  analysis,
}: {
  analysis: InsightsAiAnalysis;
}) {
  const theme = useTheme();
  const primaryWatchpoints = [...analysis.darkTriad]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);

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
        <Sparkles color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Self-Protection Watchpoints
        </Text>
      </View>
      <Text style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}>
        Gentle watchpoints for the week, framed as temporary coping signals.
      </Text>

      <View style={styles.watchpointList}>
        {primaryWatchpoints.map(item => {
          const toneColor = WATCHPOINT_COLORS[item.band];

          return (
            <View
              key={item.trait}
              style={[
                styles.watchpointCard,
                { backgroundColor: hexToRgba(toneColor, 0.08) },
              ]}
            >
              <View style={styles.watchpointHeaderRow}>
                <View style={styles.watchpointTitleWrap}>
                  <Text style={[styles.watchpointTitle, { color: theme.colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text
                    style={[styles.watchpointSubtitle, { color: theme.colors.mutedForeground }]}
                  >
                    {item.supportiveLabel}
                  </Text>
                </View>
                <View
                  style={[
                    styles.traitBandPill,
                    { backgroundColor: hexToRgba(toneColor, 0.14) },
                  ]}
                >
                  <Text style={[styles.traitBandText, { color: toneColor }]}>
                    {item.band}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.traitTrack,
                  { backgroundColor: hexToRgba(toneColor, 0.14) },
                ]}
              >
                <View
                  style={[
                    styles.traitFill,
                    {
                      width: `${item.score}%`,
                      backgroundColor: toneColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.patternSubtitle, { color: theme.colors.mutedForeground }]}>
                {getFirstSentence(item.description)}
              </Text>
              <View
                style={[
                  styles.watchpointTipCard,
                  { backgroundColor: hexToRgba(theme.colors.card, 0.78) },
                ]}
              >
                <Text style={[styles.keyInsightLabel, { color: theme.colors.mutedForeground }]}>
                  Gentle counter-step
                </Text>
                <Text style={[styles.watchpointTipText, { color: theme.colors.foreground }]}>
                  {item.supportTip}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ActionPlanCard({
  analysis,
}: {
  analysis: InsightsAiAnalysis;
}) {
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
        <Award color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Actionable Steps
        </Text>
      </View>
      <Text style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}>
        {truncateWords(analysis.actionPlan.headline, 12)}
      </Text>

      <View style={styles.actionList}>
        {analysis.actionPlan.steps.map((step, index) => (
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
              <Text style={[styles.actionIndexText, { color: theme.colors.primary }]}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.actionCopy}>
              <View style={styles.actionHeaderRow}>
                <Text style={[styles.patternTitle, { color: theme.colors.foreground }]}>
                  {step.title}
                </Text>
              </View>
              <View
                style={[
                  styles.actionFocusPill,
                  { backgroundColor: hexToRgba(theme.colors.secondaryForeground, 0.08) },
                ]}
              >
                <Text style={[styles.actionFocusText, { color: theme.colors.mutedForeground }]}>
                  {step.focus}
                </Text>
              </View>
              <Text style={[styles.patternSubtitle, { color: theme.colors.mutedForeground }]}>
                {truncateWords(step.description, 18)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AppSupportCard({
  analysis,
}: {
  analysis: InsightsAiAnalysis;
}) {
  const theme = useTheme();
  const supportItems = analysis.appSupport.items.slice(0, 2);

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
        <Leaf color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          How Journal.IO Helps
        </Text>
      </View>
      <Text style={[styles.cardSubtitle, { color: theme.colors.mutedForeground }]}>
        {truncateWords(analysis.appSupport.headline, 12)}
      </Text>

      <View style={styles.appSupportList}>
        {supportItems.map(item => (
          <View
            key={item.title}
            style={[
              styles.appSupportCard,
              { backgroundColor: hexToRgba(theme.colors.primary, 0.06) },
            ]}
          >
            <Text style={[styles.patternTitle, { color: theme.colors.foreground }]}>
              {item.title}
            </Text>
            <Text style={[styles.patternSubtitle, { color: theme.colors.mutedForeground }]}>
              {truncateWords(item.description, 16)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AnalysisSection({
  analysis,
}: {
  analysis: InsightsAiAnalysis;
}) {
  return (
    <View style={styles.sectionStack}>
      <AnalysisHeroCard analysis={analysis} />
      <PersonalityTraitsCard analysis={analysis} />
      <WatchpointsCard analysis={analysis} />
      <ActionPlanCard analysis={analysis} />
      <AppSupportCard analysis={analysis} />
    </View>
  );
}

function ErrorState({
  onRetry,
  title = "Unable to load insights",
  message = "We could not fetch your latest insights right now.",
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
        <Text style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.emptyStateText, { color: theme.colors.mutedForeground }]}>
          {message}
        </Text>
        <Pressable
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
          <Text style={[styles.retryButtonText, { color: theme.colors.primaryForeground }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    </SectionCard>
  );
}

function LoadingState() {
  const theme = useTheme();

  return (
    <SectionCard>
      <View style={styles.emptyState}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}>
          Loading insights
        </Text>
        <Text style={[styles.emptyStateText, { color: theme.colors.mutedForeground }]}>
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
        <View
          style={[
            styles.lockedIconWrap,
            { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
          ]}
        >
          <Lock color={theme.colors.primary} size={22} />
        </View>
        <Text style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}>
          AI Analysis is a premium feature
        </Text>
        <Text style={[styles.emptyStateText, { color: theme.colors.mutedForeground }]}>
          Upgrade to unlock weekly behavior analysis, trait signals, supportive
          watchpoints, and guided next steps.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open subscription"
          onPress={onOpenSubscription}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Lock color={theme.colors.primaryForeground} size={14} />
          <Text style={[styles.retryButtonText, { color: theme.colors.primaryForeground }]}>
            Open Subscription
          </Text>
        </Pressable>
      </View>
    </SectionCard>
  );
}

function AnalysisLoadingState() {
  const theme = useTheme();

  return (
    <SectionCard>
      <View style={styles.emptyState}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}>
          Loading AI analysis
        </Text>
        <Text style={[styles.emptyStateText, { color: theme.colors.mutedForeground }]}>
          Building your weekly behavior read from recent entries and mood check-ins.
        </Text>
      </View>
    </SectionCard>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isPremiumUser = useAppStore(state => Boolean(state.session?.user.isPremium));
  const setMainAppTab = useAppStore(state => state.setActiveTab);
  const preferredInsightsTab = useAppStore(state => state.preferredInsightsTab);
  const clearPreferredInsightsTab = useAppStore(
    state => state.clearPreferredInsightsTab
  );
  const [activeTab, setActiveTab] = useState<InsightTab>(
    () => useAppStore.getState().preferredInsightsTab || "overview"
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
  const horizontalPadding = useMemo(() => Math.max(16, Math.min(24, width * 0.05)), [width]);
  const layoutMaxWidth = width >= 430 ? 470 : 430;
  const thumbWidth = segmentedWidth > 0 ? (segmentedWidth - 6 - 4) / 2 : 0;

  const loadInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextData = await getInsightsOverview();
      setData(nextData);
      setSelectedActivityIndex(
        nextData.activity7d.length ? Math.min(3, nextData.activity7d.length - 1) : 0
      );
      setSelectedSegmentIndex(0);
      setAnalysisError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load insights right now."
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
      } catch (loadError) {
        setAnalysisError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load AI analysis right now."
        );
      } finally {
        setIsAnalysisLoading(false);
      }
    },
    [aiAnalysis, isPremiumUser]
  );

  const handleSelectTab = (nextTab: InsightTab) => {
    setActiveTab(nextTab);
  };

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
          nextData.activity7d.length ? Math.min(3, nextData.activity7d.length - 1) : 0
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
            : "Unable to load insights right now."
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
    if (!isPremiumUser || activeTab !== "analysis") {
      return;
    }

    loadAiAnalysis().catch(() => undefined);
  }, [activeTab, isPremiumUser, loadAiAnalysis]);

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
      toValue: activeTab === "overview" ? 0 : thumbWidth + 4,
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
            selected={activeTab === "overview"}
            onPress={() => handleSelectTab("overview")}
          />
          <TabPill
            theme={theme}
            label="AI Analysis"
            selected={activeTab === "analysis"}
            icon={isPremiumUser ? Sparkles : Lock}
            onPress={() => handleSelectTab("analysis")}
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
            {activeTab === "overview" ? (
              <OverviewSection
                data={data}
                isVisible={activeTab === "overview"}
                selectedActivityIndex={selectedActivityIndex}
                onSelectActivityIndex={setSelectedActivityIndex}
                selectedSegmentIndex={selectedSegmentIndex}
                onSelectSegmentIndex={setSelectedSegmentIndex}
              />
            ) : !isPremiumUser ? (
              <LockedAiAnalysisCard onOpenSubscription={() => setMainAppTab("profile")} />
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
            ) : (
              <AnalysisSection analysis={aiAnalysis} />
            )}
          </Animated.View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 2,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  segmentedControl: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    padding: 3,
    gap: 4,
    overflow: "hidden",
  },
  segmentThumb: {
    position: "absolute",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabPillLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  tabPillLabelSelected: {
    fontWeight: "700",
  },
  tabPillLabelDefault: {
    fontWeight: "600",
  },
  sectionStack: {
    gap: 14,
  },
  sectionTransition: {
    width: "100%",
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 138,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: "space-between",
    minHeight: 92,
  },
  statLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  chartWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  yLabels: {
    width: 18,
    height: 172,
    justifyContent: "space-between",
    paddingTop: 14,
    paddingBottom: 28,
  },
  axisLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  axisLabelSelected: {
    fontWeight: "700",
  },
  axisLabelDefault: {
    fontWeight: "400",
  },
  chartBody: {
    position: "relative",
  },
  chartSvg: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chartHitArea: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  chartLabelsRow: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
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
    fontWeight: "600",
  },
  chartFooterValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  breakdownShell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  breakdownChartWrap: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownCenterLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownPercent: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
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
    alignSelf: "stretch",
    justifyContent: "center",
  },
  breakdownLegendRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "600",
  },
  breakdownLegendValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  breakdownLegendCopy: {
    flex: 1,
    gap: 5,
  },
  breakdownLegendTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  breakdownLegendTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(131, 125, 119, 0.16)",
  },
  breakdownLegendFill: {
    height: "100%",
    borderRadius: 999,
  },
  topicList: {
    gap: 18,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 30,
  },
  topicLabel: {
    fontSize: 14,
    lineHeight: 19,
    width: 126,
    flexShrink: 0,
    fontWeight: "600",
  },
  topicValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    width: 32,
    flexShrink: 0,
    textAlign: "right",
  },
  topicTrack: {
    width: 154,
    flexShrink: 0,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(131, 125, 119, 0.16)",
    overflow: "hidden",
  },
  topicFill: {
    height: "100%",
    borderRadius: 999,
  },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  summaryBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  analysisHeadline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  analysisMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  analysisMetaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  analysisMetaPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  analysisContentStack: {
    gap: 12,
    marginBottom: 14,
  },
  analysisMetaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  analysisHeroCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  analysisStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  analysisStatCard: {
    flex: 1,
    minWidth: 120,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginBottom: 12,
  },
  analysisStatValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  analysisStatLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  analysisSupportCopy: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  patternTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontWeight: "700",
  },
  keyInsightCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  keyInsightLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  keyInsightText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  traitList: {
    gap: 12,
  },
  traitCard: {
    gap: 8,
    paddingBottom: 2,
  },
  traitHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  traitLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
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
    fontWeight: "700",
    textTransform: "capitalize",
  },
  traitTrack: {
    width: "100%",
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
  },
  traitFill: {
    height: "100%",
    borderRadius: 999,
  },
  traitScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  traitScoreText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  traitSupportText: {
    fontSize: 11,
    lineHeight: 14,
  },
  traitEvidenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontWeight: "600",
  },
  promptList: {
    gap: 10,
    marginTop: 2,
  },
  promptTopicRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "700",
  },
  promptTopicLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  promptCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  promptItemText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  patternList: {
    gap: 14,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  patternIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  patternCopy: {
    flex: 1,
  },
  patternTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    marginBottom: 2,
  },
  patternSubtitle: {
    fontSize: 13,
    lineHeight: 18,
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  watchpointTitleWrap: {
    flex: 1,
  },
  watchpointTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
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
    fontWeight: "600",
  },
  actionList: {
    gap: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  actionIndexText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  actionCopy: {
    flex: 1,
    gap: 4,
  },
  actionHeaderRow: {
    gap: 2,
  },
  actionFocusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  actionFocusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
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
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
  },
  lockedState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
  },
  lockedIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  retryButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.9,
  },
});
