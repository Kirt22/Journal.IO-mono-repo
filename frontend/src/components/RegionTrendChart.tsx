import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../infrastructure/reactNative';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

export type RegionTrendPoint = {
  label: string;
  value: number;
};

type Props = {
  points: RegionTrendPoint[];
  color: string;
  gridColor: string;
  labelColor: string;
  height?: number;
  emptyLabel?: string;
};

const PADDING_TOP = 12;
const PADDING_BOTTOM = 12;
const PADDING_X = 6;

// Small, self-contained area+line chart for a single region's development over
// a window. Values are 0-1 signals; the scale is 0 → a little above the peak so
// the shape stays readable. No external charting library — react-native-svg
// only, matching the rest of the app.
export default function RegionTrendChart({
  points,
  color,
  gridColor,
  labelColor,
  height = 150,
  emptyLabel = 'Not enough entries yet to chart this area.',
}: Props) {
  const [width, setWidth] = useState(0);

  const values = points.map(point => Math.max(0, Math.min(1, point.value)));
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  const maxValue = Math.min(1, Math.max(0.25, peak * 1.2));

  const plotWidth = Math.max(0, width - PADDING_X * 2);
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const renderBody = () => {
    if (values.length === 0) {
      return (
        <View style={[styles.emptyState, { height }]}>
          <Text style={[styles.emptyText, { color: labelColor }]}>
            {emptyLabel}
          </Text>
        </View>
      );
    }

    if (width === 0) {
      // First layout pass — reserve height, draw on the next frame.
      return <View style={{ height }} />;
    }

    const step = values.length > 1 ? plotWidth / (values.length - 1) : 0;
    const coords = values.map((value, index) => {
      const normalized = value / maxValue;
      const x =
        values.length > 1 ? PADDING_X + step * index : PADDING_X + plotWidth / 2;
      const y = PADDING_TOP + plotHeight - plotHeight * normalized;
      return { x, y };
    });

    const linePath = coords
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
    const baselineY = PADDING_TOP + plotHeight;
    const areaPath =
      values.length > 1
        ? `${linePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`
        : '';

    return (
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="regionTrendArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {[0.5, 1].map(fraction => {
          const y = PADDING_TOP + plotHeight - plotHeight * fraction;
          return (
            <Line
              key={`grid-${fraction}`}
              x1={PADDING_X}
              y1={y}
              x2={PADDING_X + plotWidth}
              y2={y}
              stroke={gridColor}
              strokeWidth={1}
            />
          );
        })}

        {areaPath ? <Path d={areaPath} fill="url(#regionTrendArea)" /> : null}

        {values.length > 1 ? (
          <Path
            d={linePath}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {coords.map((point, index) => (
          <Circle
            key={`dot-${index}`}
            cx={point.x}
            cy={point.y}
            r={values.length > 12 ? 2 : 3}
            fill={color}
          />
        ))}
      </Svg>
    );
  };

  // Up to ~5 evenly-spaced ticks (always including the first and last) so a
  // longer, more granular series shows intermediate dates without crowding.
  const axisTicks = sampleAxisTicks(points, 5);

  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {renderBody()}
      {axisTicks.length > 1 ? (
        <View style={styles.axisRow}>
          {axisTicks.map((tick, index) => (
            <Text
              key={`${tick.label}-${tick.index}`}
              numberOfLines={1}
              style={[
                styles.axisLabel,
                { color: labelColor },
                index === 0 && styles.axisLabelStart,
                index === axisTicks.length - 1 && styles.axisLabelEnd,
              ]}
            >
              {tick.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Pick up to `maxTicks` evenly-spaced points (first & last always included) to
// label on the x-axis, keeping the axis readable when there are many buckets.
function sampleAxisTicks(points: RegionTrendPoint[], maxTicks: number) {
  if (points.length <= maxTicks) {
    return points.map((point, index) => ({ label: point.label, index }));
  }

  const ticks: { label: string; index: number }[] = [];
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const index = Math.round((tick * (points.length - 1)) / (maxTicks - 1));
    ticks.push({ label: points[index].label, index });
  }
  return ticks;
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  axisLabelStart: {
    textAlign: 'left',
  },
  axisLabelEnd: {
    textAlign: 'right',
  },
});
