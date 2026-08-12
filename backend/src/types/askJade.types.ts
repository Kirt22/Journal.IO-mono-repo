/**
 * Wire shapes for Ask Jade. Kept separate from the Mongoose documents so the
 * API contract can stay stable while storage evolves.
 */

export type JadeMessageStatus = "ok" | "fallback" | "support_first";

export type JadeMessageResponse = {
  id: string;
  seq: number;
  role: "user" | "assistant";
  text: string;
  status: JadeMessageStatus;
  createdAt: string;
};

export type JadeSessionSummaryResponse = {
  id: string;
  title: string;
  lastMessagePreview: string;
  messageCount: number;
  lastMessageAt: string;
};

export type JadeTurnLimits = {
  turnsUsedToday: number;
  turnsPerDay: number;
  /** ISO timestamp when the daily allowance resets; null while under the cap. */
  resetAt: string | null;
};

export type JadeSessionListResponse = {
  sessions: JadeSessionSummaryResponse[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type JadeSessionThreadResponse = {
  session: JadeSessionSummaryResponse;
  messages: JadeMessageResponse[];
  pagination: {
    /** Walks backwards into older history; null once the start is reached. */
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type JadeSendMessageResponse = {
  sessionId: string;
  title: string;
  userMessage: JadeMessageResponse;
  reply: JadeMessageResponse;
  limits: JadeTurnLimits;
};
