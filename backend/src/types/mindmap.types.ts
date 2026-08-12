import type {
  OverallReflectionTier,
  ReflectionRegionId,
  ReflectionRegionIntensity,
  ReflectionRegionTier,
} from "../helpers/reflectionMap.helpers";

export type MindMapEntryRegion = {
  id: ReflectionRegionId;
  productLabel: string;
  brainRegionSubtitle: string;
  signalScore: number;
  confidence: number;
  rank: number;
  intensity: ReflectionRegionIntensity;
  shortInsight: string;
  evidenceSnippets: string[];
  // How strongly this entry leaned into the region versus a typical reflector.
  tier: ReflectionRegionTier;
  tierLabel: string;
};

export type MindMapEntryDisclaimer = {
  title: string;
  body: string;
};

export type MindMapEntrySummary = {
  headline: string;
  narrative: string;
  seedText: string;
};

// A therapist-style theme noticed in this single entry: the pattern, why it was
// concluded, and the user's own sentence that supports it.
export type MindMapEntryPattern = {
  id: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  confidence: number;
};

export type MindMapEntryReadyResponse = {
  status: "ready";
  journalId: string;
  entryType: "open_ended" | "guided";
  source: "ai" | "heuristic";
  // true while the map is heuristic-only and an AI upgrade may still land.
  refining: boolean;
  strongestRegionId: ReflectionRegionId;
  // Themes noticed in this entry, shown after the strongest region.
  patterns: MindMapEntryPattern[];
  regions: MindMapEntryRegion[];
  // Overall reflective style read for this single entry (named band).
  overallTier: OverallReflectionTier;
  summary: MindMapEntrySummary;
  disclaimer: MindMapEntryDisclaimer;
};

export type MindMapEntrySupportFirstResponse = {
  status: "support_first";
  journalId: string;
  entryType: "open_ended" | "guided";
  support: {
    headline: string;
    body: string;
    note: string;
  };
  disclaimer: MindMapEntryDisclaimer;
};

export type MindMapEntryResponse =
  | MindMapEntryReadyResponse
  | MindMapEntrySupportFirstResponse;
