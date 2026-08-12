/**
 * Long-term "rolling memory" for a user: a compact, AI-maintained narrative of
 * the ongoing situations, relationships, and sensitive themes they have been
 * working through across ALL of their entries. Unlike per-entry insights (which
 * are precise but recency-limited), this is a whole-history summary kept bounded
 * in size, so guided reflection can carry forward the arc of someone's life
 * without re-reading every past entry.
 */
export type UserMemoryOngoingThread = {
  /** Short label, e.g. "Tension with partner", "Job search stress". */
  label: string;
  /** One-line status of where this thread currently stands. */
  status: string;
};

export type UserMemoryStructured = {
  ongoingThreads: UserMemoryOngoingThread[];
  keyRelationships: string[];
  /**
   * Heavy / sensitive topics the user has raised themselves (grief, loss,
   * trauma, etc.) so the assistant can acknowledge them with care. Never a
   * clinical diagnosis — only what the user named.
   */
  sensitiveTopics: string[];
};

export type UserMemory = {
  narrative: string;
  structured: UserMemoryStructured;
  entriesCoveredThrough: Date | null;
  entriesCoveredCount: number;
  version: string;
  aiModel: string | null;
  updatedAt: Date | null;
};
