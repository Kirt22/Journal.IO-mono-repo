import type { BrainReflectionCenterId } from "../../services/guidedReflectionService";

export type MindMapNativeRegion = {
  id: BrainReflectionCenterId;
  label: string;
  subtitle: string;
  signalScore: number;
  confidence: number;
  intensity: "low" | "moderate" | "high";
  isStrongest: boolean;
};
