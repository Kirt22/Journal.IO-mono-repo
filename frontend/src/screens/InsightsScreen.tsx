import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Animated, Easing } from "react-native";
import {
  Award,
  Brain,
  Leaf,
  PieChart,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "../infrastructure/reactNative";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from "react-native-svg";
import TabScreenLayout from "../components/TabScreenLayout";
import { useTheme } from "../theme/provider";

type InsightTab = "overview" | "analysis";

type StatCard = {
  label: string;
  value: string;
};

type PatternItem = {
  title: string;
  subtitle: string;
  icon: typeof Award;
  iconColor: string;
};

type PromptItem = {
  text: string;
};

type BreakdownSegment = {
  label: string;
  value: number;
  color: string;
};

type TopicItem = {
  label: string;
  value: number;
  color: string;
};

const overviewStats: StatCard[] = [
  { label: "Total Entries", value: "5" },
  { label: "Current Streak", value: "12 days" },
  { label: "Avg Words", value: "26" },
  { label: "Favorites", value: "2" },
];

const weekActivity = [
  { label: "Fri", value: 1 },
  { label: "Sat", value: 0 },
  { label: "Sun", value: 0 },
  { label: "Mon", value: 4 },
  { label: "Tue", value: 3 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 1 },
];

const patternItems: PatternItem[] = [
  {
    title: "Emotional Awareness",
    subtitle: "You're getting better at identifying and expressing complex emotions",
    icon: Award,
    iconColor: "#8AB39A",
  },
  {
    title: "Gratitude Practice",
    subtitle: "Your entries increasingly focus on positive experiences and appreciation",
    icon: Star,
    iconColor: "#7D9FD6",
  },
  {
    title: "Nature & Reflection",
    subtitle: "Calm moments and outdoors time appear associated with steadier writing",
    icon: Leaf,
    iconColor: "#E6816D",
  },
];

const personalizedPrompts: PromptItem[] = [
  {
    text: "What felt most steady or grounding in your day?",
  },
  {
    text: "Where did your mood shift, and what seemed to influence it?",
  },
  {
    text: "What is one small thing you want to carry into tomorrow?",
  },
];

const moodDistributionSegments: BreakdownSegment[] = [
  { label: "Amazing", value: 18, color: "#E6816D" },
  { label: "Good", value: 34, color: "#7D9FD6" },
  { label: "Okay", value: 28, color: "#E9A15B" },
  { label: "Bad", value: 12, color: "#8E939A" },
  { label: "Terrible", value: 8, color: "#D26A6A" },
];

const popularTopics: TopicItem[] = [
  {
    label: "Morning routines",
    value: 32,
    color: "#E6816D",
  },
  {
    label: "Work stress",
    value: 24,
    color: "#7D9FD6",
  },
  {
    label: "Relationships",
    value: 18,
    color: "#8AB39A",
  },
  {
    label: "Sleep & energy",
    value: 14,
    color: "#E9A15B",
  },
  {
    label: "Gratitude",
    value: 12,
    color: "#A47BD6",
  },
];

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

function useRevealProgress(isVisible: boolean) {
  const progress = useRef(new Animated.Value(isVisible ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();

    if (!isVisible) {
      progress.setValue(0);
      return undefined;
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
      style={({ pressed }: { pressed: boolean }) => [
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
          {
            color: theme.colors.foreground,
          },
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

function ActivityChart({
  selectedIndex,
  onSelectIndex,
}: {
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
        values: weekActivity.map(item => item.value),
        maxValue: 4,
      }),
    [chartHeight, chartWidth]
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
            <G key={weekActivity[index].label}>
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
              key={`hit-${weekActivity[index].label}`}
              accessibilityRole="button"
              accessibilityLabel={`Select ${weekActivity[index].label} activity`}
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
          {weekActivity.map((item, index) => (
            <Text
              key={item.label}
              style={[
                styles.axisLabel,
                {
                  color: index === 3 ? theme.colors.primary : theme.colors.mutedForeground,
                },
                index === 3 ? styles.axisLabelSelected : styles.axisLabelDefault,
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

function buildDonutSegments({
  segments,
  center,
  outerRadius,
  innerRadius,
}: {
  segments: BreakdownSegment[];
  center: number;
  outerRadius: number;
  innerRadius: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let currentAngle = -90;

  return segments.map(segment => {
    const sliceAngle = (segment.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    return {
      label: segment.label,
      color: segment.color,
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

function BreakdownChart({
  selectedIndex,
  onSelectIndex,
}: {
  selectedIndex: number;
  onSelectIndex: (nextIndex: number) => void;
}) {
  const theme = useTheme();
  const size = 150;
  const strokeWidth = 18;
  const outerRadius = (size - strokeWidth) / 2;
  const innerRadius = outerRadius - strokeWidth;
  const center = size / 2;
  const selectedSegment = moodDistributionSegments[selectedIndex] || moodDistributionSegments[0];
  const segmentPaths = useMemo(
    () =>
      buildDonutSegments({
        segments: moodDistributionSegments,
        center,
        outerRadius,
        innerRadius,
      }),
    [center, innerRadius, outerRadius]
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

            return (
              <Path
                key={segment.label}
                d={segment.path}
                fill={segment.color}
                opacity={isSelected ? 1 : 0.7}
                onPress={() => onSelectIndex(index)}
                testID={`breakdown-segment-${index}`}
              />
            );
          })}

        </Svg>

        <View style={styles.breakdownCenterLabel}>
          <Text style={[styles.breakdownPercent, { color: theme.colors.foreground }]}>
            {selectedSegment.value}%
          </Text>
          <Text style={[styles.breakdownCaption, { color: theme.colors.mutedForeground }]}>
            {selectedSegment.label}
          </Text>
        </View>
      </View>

      <View style={styles.breakdownLegend}>
        {moodDistributionSegments.map((segment, index) => (
          <Pressable
            key={segment.label}
            accessibilityRole="button"
            accessibilityLabel={`Select ${segment.label} slice`}
            onPress={() => onSelectIndex(index)}
            style={({ pressed }: { pressed: boolean }) => [
              styles.breakdownLegendRow,
              index === selectedIndex && styles.breakdownLegendRowSelected,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.breakdownLegendSwatch,
                { backgroundColor: segment.color },
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
                  {segment.value}%
                </Text>
              </View>
              <View style={styles.breakdownLegendTrack}>
                <View
                  style={[
                    styles.breakdownLegendFill,
                    {
                      width: `${segment.value}%`,
                      backgroundColor: segment.color,
                    },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PopularTopicsCard({
  progress,
}: {
  progress: Animated.Value;
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
        {popularTopics.map(topic => (
          <View key={topic.label} style={styles.topicRow}>
            <Text style={[styles.topicLabel, { color: theme.colors.foreground }]}>
              {topic.label}
            </Text>
            <View style={styles.topicTrack}>
              <View
                style={[
                  styles.topicFill,
                  {
                    width: `${topic.value}%`,
                    backgroundColor: topic.color,
                  },
                ]}
              />
            </View>
            <Text style={[styles.topicValue, { color: theme.colors.mutedForeground }]}>
              {topic.value}%
            </Text>
          </View>
        ))}
      </View>
    </RevealSurface>
  );
}

function OverviewSection({
  isVisible,
  selectedActivityIndex,
  onSelectActivityIndex,
  selectedSegmentIndex,
  onSelectSegmentIndex,
}: {
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
          {overviewStats.map(stat => (
            <StatCardView key={stat.label} label={stat.label} value={stat.value} />
          ))}
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
          selectedIndex={selectedActivityIndex}
          onSelectIndex={onSelectActivityIndex}
        />
        <View style={styles.chartFooter}>
          <Text style={[styles.chartFooterLabel, { color: theme.colors.mutedForeground }]}>
            Selected Day
          </Text>
          <Text style={[styles.chartFooterValue, { color: theme.colors.foreground }]}>
            {weekActivity[selectedActivityIndex]?.label || "Fri"} •{" "}
            {weekActivity[selectedActivityIndex]?.value || 0} journaling sessions
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
          selectedIndex={selectedSegmentIndex}
          onSelectIndex={onSelectSegmentIndex}
        />
      </RevealSurface>

      <PopularTopicsCard
        progress={topicsProgress}
      />
    </View>
  );
}

function SummaryCard() {
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
        <Brain color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          This Week&apos;s Summary
        </Text>
      </View>

      <Text style={[styles.summaryBody, { color: theme.colors.foreground }]}>
        This week, you&apos;ve shown remarkable consistency in your journaling practice.
        Your entries reflect a growing sense of gratitude and mindfulness, with recurring
        themes around nature, personal growth, and meaningful connections.
      </Text>

      <View
        style={[
          styles.keyInsightCard,
          {
            backgroundColor: hexToRgba(theme.colors.primary, 0.08),
          },
        ]}
      >
        <Text style={[styles.keyInsightLabel, { color: theme.colors.mutedForeground }]}>
          Key Insight
        </Text>
        <Text style={[styles.keyInsightText, { color: theme.colors.foreground }]}>
          You tend to write most productively in the morning, and your mood improves
          throughout the day.
        </Text>
      </View>
    </View>
  );
}

function GrowthPatternsCard() {
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
        <TrendingUp color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Growth Patterns
        </Text>
      </View>

      <View style={styles.patternList}>
        {patternItems.map(item => {
          const Icon = item.icon;

          return (
            <View key={item.title} style={styles.patternRow}>
              <View
                style={[
                  styles.patternIconWrap,
                  { backgroundColor: hexToRgba(item.iconColor, 0.12) },
                ]}
              >
                <Icon color={item.iconColor} size={16} />
              </View>

              <View style={styles.patternCopy}>
                <Text style={[styles.patternTitle, { color: theme.colors.foreground }]}>
                  {item.title}
                </Text>
                <Text style={[styles.patternSubtitle, { color: theme.colors.mutedForeground }]}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PersonalizedPromptsCard() {
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
        <Sparkles color={theme.colors.primary} size={18} />
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          Personalized Prompts
        </Text>
      </View>

      <View style={styles.promptTopicRow}>
        <View
          style={[
            styles.promptTopicPill,
            { backgroundColor: hexToRgba(theme.colors.primary, 0.1) },
          ]}
        >
          <Text style={[styles.promptTopicPillText, { color: theme.colors.primary }]}>
            Reflection
          </Text>
        </View>
        <Text style={[styles.promptTopicLabel, { color: theme.colors.mutedForeground }]}>
          Suggested topic
        </Text>
      </View>

      <View style={styles.promptList}>
        {personalizedPrompts.map(prompt => (
          <View
            key={prompt.text}
            style={[
              styles.promptCard,
              { backgroundColor: hexToRgba(theme.colors.primary, 0.08) },
            ]}
          >
            <Text style={[styles.promptItemText, { color: theme.colors.foreground }]}>
              {prompt.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AnalysisSection() {
  return (
    <View style={styles.sectionStack}>
      <SummaryCard />
      <GrowthPatternsCard />
      <PersonalizedPromptsCard />
    </View>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<InsightTab>("overview");
  const [selectedActivityIndex, setSelectedActivityIndex] = useState(3);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const thumbX = useRef(new Animated.Value(0)).current;
  const contentProgress = useRef(new Animated.Value(1)).current;
  const horizontalPadding = useMemo(() => Math.max(16, Math.min(24, width * 0.05)), [width]);
  const layoutMaxWidth = width >= 430 ? 470 : 430;
  const thumbWidth = segmentedWidth > 0 ? (segmentedWidth - 6 - 4) / 2 : 0;

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
            onPress={() => setActiveTab("overview")}
          />
          <TabPill
            theme={theme}
            label="AI Analysis"
            selected={activeTab === "analysis"}
            icon={Sparkles}
            onPress={() => setActiveTab("analysis")}
          />
        </View>

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
              isVisible={activeTab === "overview"}
              selectedActivityIndex={selectedActivityIndex}
              onSelectActivityIndex={setSelectedActivityIndex}
              selectedSegmentIndex={selectedSegmentIndex}
              onSelectSegmentIndex={setSelectedSegmentIndex}
            />
          ) : (
            <AnalysisSection />
          )}
        </Animated.View>
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
    marginBottom: 14,
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
  pressed: {
    opacity: 0.9,
  },
});
