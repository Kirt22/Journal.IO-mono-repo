import type { BrainMapSnapshot } from "./brainMapTypes";

export type BrainMapDensityMode = "emerging" | "forming" | "dense";

export type BrainMapRenderProfile = {
  densityMode: BrainMapDensityMode;
  densityLabel: string;
  scaffoldOpacity: number;
  edgeOpacityBoost: number;
  hullOpacityBoost: number;
  inactiveEdgeOpacity: number;
  minZoomDistance: number;
  maxZoomDistance: number;
  maxVisibleEdges: number;
  maxVisibleLabels: number;
};

export function getBrainMapRenderProfile(
  snapshot: BrainMapSnapshot
): BrainMapRenderProfile {
  const nodeCount = snapshot.nodes.length;
  const edgeCount = snapshot.edges.length;

  if (nodeCount < 28) {
    return {
      densityMode: "emerging",
      densityLabel: "Emerging map",
      scaffoldOpacity: 0.86,
      edgeOpacityBoost: 1.48,
      hullOpacityBoost: 1.42,
      inactiveEdgeOpacity: 0.08,
      minZoomDistance: 3.2,
      maxZoomDistance: 9.8,
      maxVisibleEdges: 52,
      maxVisibleLabels: 3,
    };
  }

  if (nodeCount > 90 || edgeCount > 140) {
    return {
      densityMode: "dense",
      densityLabel: "Focused map",
      scaffoldOpacity: 0.46,
      edgeOpacityBoost: 1.12,
      hullOpacityBoost: 1.08,
      inactiveEdgeOpacity: 0.07,
      minZoomDistance: 3.05,
      maxZoomDistance: 10.4,
      maxVisibleEdges: 150,
      maxVisibleLabels: 5,
    };
  }

  return {
    densityMode: "forming",
    densityLabel: "Forming map",
    scaffoldOpacity: 0.56,
    edgeOpacityBoost: 1.08,
    hullOpacityBoost: 0.95,
    inactiveEdgeOpacity: 0.055,
    minZoomDistance: 3.05,
    maxZoomDistance: 9.6,
    maxVisibleEdges: 56,
    maxVisibleLabels: 4,
  };
}
