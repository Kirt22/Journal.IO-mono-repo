import HapticPressable from '../../components/HapticPressable';
import {
  useMemo,
  useState } from "react";
import {
  StyleSheet,
  View,
} from "react-native";
import {
  Text,
} from "../../infrastructure/reactNative";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import NativeMindMapView, {
  type NativeMindMapRegionPressEvent,
} from "./NativeMindMapView";
import { getBrainMapColors, withAlpha } from "./brainMapTheme";
import type { MindMapNativeRegion } from "./mindMapRegionTypes";
import { useTheme } from "../../theme/provider";

type BrainMapDevScreenProps = {
  onBack: () => void;
};

const DEV_REGIONS: MindMapNativeRegion[] = [
  {
    id: "planning_self_control",
    label: "Planning & Self-Control",
    subtitle: "Prefrontal Cortex",
    signalScore: 1,
    confidence: 0.82,
    intensity: "high",
    isStrongest: true,
  },
  {
    id: "emotional_intensity",
    label: "Emotional Intensity",
    subtitle: "Amygdala",
    signalScore: 0.72,
    confidence: 0.7,
    intensity: "high",
    isStrongest: false,
  },
  {
    id: "memory_meaning",
    label: "Memory & Meaning",
    subtitle: "Hippocampus",
    signalScore: 0.58,
    confidence: 0.68,
    intensity: "moderate",
    isStrongest: false,
  },
  {
    id: "body_inner_signals",
    label: "Body & Inner Signals",
    subtitle: "Insula",
    signalScore: 0.46,
    confidence: 0.62,
    intensity: "moderate",
    isStrongest: false,
  },
  {
    id: "conflict_attention",
    label: "Conflict & Attention",
    subtitle: "Anterior Cingulate Cortex",
    signalScore: 0.41,
    confidence: 0.6,
    intensity: "moderate",
    isStrongest: false,
  },
  {
    id: "motivation_reward",
    label: "Motivation & Reward",
    subtitle: "Reward Circuit / Ventral Striatum",
    signalScore: 0.51,
    confidence: 0.64,
    intensity: "moderate",
    isStrongest: false,
  },
  {
    id: "relationships_perspective",
    label: "Relationships & Perspective",
    subtitle: "Social Brain / Temporoparietal Junction",
    signalScore: 0.36,
    confidence: 0.55,
    intensity: "moderate",
    isStrongest: false,
  },
  {
    id: "self_reflection_identity",
    label: "Self-Reflection & Identity",
    subtitle: "Default Mode Network",
    signalScore: 0.33,
    confidence: 0.58,
    intensity: "low",
    isStrongest: false,
  },
];

export default function BrainMapDevScreen({ onBack }: BrainMapDevScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const colors = getBrainMapColors(theme);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    DEV_REGIONS[0]?.id || null
  );
  const selectedRegion = useMemo(
    () => DEV_REGIONS.find(region => region.id === selectedRegionId) || DEV_REGIONS[0],
    [selectedRegionId]
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerRow}>
          <HapticPressable
            accessibilityLabel="Back to Profile"
            onPress={onBack}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.1),
                borderColor: withAlpha(colors.nodeHot, 0.18),
              },
              pressed && styles.pressed,
            ]}
          >
            <ArrowLeft color={colors.text} size={18} />
          </HapticPressable>
          <View
            style={[
              styles.devBadge,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.12),
                borderColor: withAlpha(colors.nodeHot, 0.2),
              },
            ]}
          >
            <Sparkles color={colors.nodeHot} size={12} />
            <Text style={[styles.devBadgeText, { color: colors.text }]}>DEV ONLY</Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Mind Map Preview</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Static sample data for the iOS region renderer.
        </Text>

        <View
          style={[
            styles.sceneFrame,
            {
              backgroundColor: colors.background,
              borderColor: withAlpha(colors.nodeHot, 0.18),
            },
          ]}
        >
          <NativeMindMapView
            cameraResetToken={cameraResetToken}
            graphPalette={colors}
            onRegionPress={(event: NativeMindMapRegionPressEvent) =>
              setSelectedRegionId(event.nativeEvent.regionId)
            }
            reduceMotionEnabled={false}
            regions={DEV_REGIONS}
            selectedRegionId={selectedRegionId}
            style={styles.nativeScene}
            themeMode={theme.mode}
          />
          <HapticPressable
            accessibilityLabel="Recenter Mind Map camera"
            onPress={() => setCameraResetToken(token => token + 1)}
            style={({ pressed }) => [
              styles.recenterButton,
              {
                backgroundColor: withAlpha(colors.nodeHot, 0.12),
                borderColor: withAlpha(colors.nodeHot, 0.24),
              },
              pressed && styles.pressed,
            ]}
          >
            <RotateCcw color={colors.nodeHot} size={14} />
            <Text style={[styles.recenterText, { color: colors.text }]}>Recenter</Text>
          </HapticPressable>
        </View>

        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(colors.outline, 0.18),
            },
          ]}
        >
          <Text style={[styles.detailsLabel, { color: colors.muted }]}>Selected region</Text>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>
            {selectedRegion?.label}
          </Text>
          <Text style={[styles.detailsBody, { color: colors.muted }]}>
            {selectedRegion?.subtitle} · {Math.round((selectedRegion?.signalScore || 0) * 100)}
            % signal
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  devBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  devBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    letterSpacing: -0.6,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sceneFrame: {
    flex: 1,
    minHeight: 360,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
  },
  nativeScene: {
    flex: 1,
  },
  recenterButton: {
    position: "absolute",
    top: 16,
    right: 16,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recenterText: {
    fontSize: 13,
    fontWeight: "700",
  },
  detailsCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 6,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  detailsBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.8,
  },
});
