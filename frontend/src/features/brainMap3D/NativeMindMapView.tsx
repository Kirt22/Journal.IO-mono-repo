import {
  requireNativeComponent,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";
import type { BrainMapColors } from "./brainMapTheme";
import type { MindMapNativeRegion } from "./mindMapRegionTypes";

export type NativeMindMapRegionPressEvent = NativeSyntheticEvent<{
  regionId: string;
}>;

export type NativeMindMapViewProps = ViewProps & {
  regions: MindMapNativeRegion[];
  selectedRegionId?: string | null;
  graphPalette: BrainMapColors;
  themeMode: "dark" | "light";
  cameraResetToken?: number;
  reduceMotionEnabled?: boolean;
  onRegionPress?: (event: NativeMindMapRegionPressEvent) => void;
};

const NativeMindMapView =
  requireNativeComponent<NativeMindMapViewProps>("JournalMindMapView");

export default NativeMindMapView;
