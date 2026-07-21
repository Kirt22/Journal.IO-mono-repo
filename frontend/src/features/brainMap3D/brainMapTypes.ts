export type BrainMapNodeType =
  | "theme"
  | "emotion"
  | "habit"
  | "goal"
  | "context"
  | "tomorrow"
  | "entry";

export type BrainMapNode = {
  id: string;
  label: string;
  type: BrainMapNodeType;
  weight: number;
  prominence: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  relatedEntryCount?: number;
  explanation?: string;
};

export type BrainMapEdge = {
  id: string;
  from: string;
  to: string;
  strength: number;
  reason?: string;
};

export type BrainMapSnapshot = {
  id: string;
  generatedAt: string;
  nodes: BrainMapNode[];
  edges: BrainMapEdge[];
  prominentNodeIds: string[];
};
