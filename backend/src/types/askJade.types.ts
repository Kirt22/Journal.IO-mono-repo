/**
 * Wire shapes for Ask Jade. Kept separate from the Mongoose documents so the
 * API contract can stay stable while storage evolves.
 */

import type { MoodValue } from "./mood.types";

export type JadeMessageStatus =
  | "ok"
  | "fallback"
  | "support_first"
  | "product_fact";

export type JadeBlockDataState = "ready" | "empty" | "unavailable";

export type JadeMessageBlock =
  | { type: "text"; text: string }
  | {
      type: "list";
      style: "bulleted" | "numbered";
      items: string[];
    }
  | {
      type: "stats";
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      items: { label: string; value: string }[];
    }
  | {
      type: "mood_trend";
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      rangeDays: 7 | 30;
      points: {
        dateKey: string;
        label: string;
        mood: MoodValue | null;
        score: number | null;
      }[];
    }
  | {
      type: "mood_distribution";
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      range: "30d" | "all_time";
      segments: {
        mood: MoodValue;
        label: string;
        count: number;
        percentage: number;
      }[];
    }
  | {
      type: "activity";
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      rangeDays: 7;
      points: { dateKey: string; label: string; count: number }[];
    };

export type JadeMessageResponse = {
  id: string;
  seq: number;
  role: "user" | "assistant";
  text: string;
  status: JadeMessageStatus;
  blocks: JadeMessageBlock[];
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
