import type { BrainReflectionCenterId } from "../../services/guidedReflectionService";

export type MindMapNativeRegion = {
  id: BrainReflectionCenterId;
  label: string;
  subtitle: string;
  signalScore: number;
  confidence: number;
  intensity: "low" | "moderate" | "high";
  isStrongest: boolean;
  // 1-based signal rank; used to number the reflection pins in the 3D renderer.
  rank?: number;
};
