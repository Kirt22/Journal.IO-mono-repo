import { request } from '../utils/apiClient';

type JadeMessageStatus = 'ok' | 'fallback' | 'support_first' | 'product_fact';
type JadeBlockDataState = 'ready' | 'empty' | 'unavailable';
type JadeMood = 'amazing' | 'good' | 'okay' | 'bad' | 'terrible';

type JadeMessageBlock =
  | { type: 'text'; text: string }
  | { type: 'list'; style: 'bulleted' | 'numbered'; items: string[] }
  | {
      type: 'stats';
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      items: { label: string; value: string }[];
    }
  | {
      type: 'mood_trend';
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      rangeDays: 7 | 30;
      points: {
        dateKey: string;
        label: string;
        mood: JadeMood | null;
        score: number | null;
      }[];
    }
  | {
      type: 'mood_distribution';
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      range: '30d' | 'all_time';
      segments: {
        mood: JadeMood;
        label: string;
        count: number;
        percentage: number;
      }[];
    }
  | {
      type: 'activity';
      title: string;
      dataState: JadeBlockDataState;
      updatedAt: string | null;
      rangeDays: 7;
      points: { dateKey: string; label: string; count: number }[];
    };

type JadeMessage = {
  id: string;
  seq: number;
  role: 'user' | 'assistant';
  text: string;
  status: JadeMessageStatus;
  /** Optional on legacy cached/test messages; service normalization supplies []. */
  blocks?: JadeMessageBlock[];
  createdAt: string;
};

type JadeSessionSummary = {
  id: string;
  title: string;
  lastMessagePreview: string;
  messageCount: number;
  lastMessageAt: string;
};

type JadeTurnLimits = {
  turnsUsedToday: number;
  turnsPerDay: number;
  /** ISO timestamp when the allowance resets; null while under the cap. */
  resetAt: string | null;
};

type JadeSessionListPage = {
  sessions: JadeSessionSummary[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

type JadeSessionThread = {
  session: JadeSessionSummary;
  messages: JadeMessage[];
  pagination: {
    /** Walks backwards into older turns as the user scrolls up. */
    nextCursor: string | null;
    hasMore: boolean;
  };
};

type JadeSendResult = {
  sessionId: string;
  title: string;
  userMessage: JadeMessage;
  reply: JadeMessage;
  limits: JadeTurnLimits;
};

const normalizeMessage = (
  record: Partial<JadeMessage> | null | undefined,
): JadeMessage => ({
  id: String(record?.id ?? ''),
  seq: Number(record?.seq ?? 0),
  role: record?.role === 'assistant' ? 'assistant' : 'user',
  text: String(record?.text ?? ''),
  status:
    record?.status === 'fallback' ||
    record?.status === 'support_first' ||
    record?.status === 'product_fact'
      ? record.status
      : 'ok',
  blocks: Array.isArray(record?.blocks)
    ? record.blocks.filter(
        (block): block is JadeMessageBlock =>
          Boolean(block) &&
          typeof block === 'object' &&
          typeof block.type === 'string',
      )
    : [],
  createdAt: String(record?.createdAt ?? new Date().toISOString()),
});

const normalizeSession = (
  record: Partial<JadeSessionSummary> | null | undefined,
): JadeSessionSummary => ({
  id: String(record?.id ?? ''),
  title: String(record?.title ?? ''),
  lastMessagePreview: String(record?.lastMessagePreview ?? ''),
  messageCount: Number(record?.messageCount ?? 0),
  lastMessageAt: String(record?.lastMessageAt ?? new Date().toISOString()),
});

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
};

const getJadeSessions = async ({
  limit = 20,
  cursor,
}: { limit?: number; cursor?: string } = {}): Promise<JadeSessionListPage> => {
  const response = await request<JadeSessionListPage>(
    `/ask-jade/sessions${buildQuery({ limit, cursor })}`,
    { method: 'GET' },
  );

  return {
    sessions: (response.data?.sessions || []).map(normalizeSession),
    pagination: {
      nextCursor: response.data?.pagination?.nextCursor ?? null,
      hasMore: Boolean(response.data?.pagination?.hasMore),
    },
  };
};

const getJadeSessionThread = async ({
  sessionId,
  limit = 30,
  cursor,
}: {
  sessionId: string;
  limit?: number;
  cursor?: string;
}): Promise<JadeSessionThread> => {
  const response = await request<JadeSessionThread>(
    `/ask-jade/sessions/${encodeURIComponent(sessionId)}${buildQuery({
      limit,
      cursor,
    })}`,
    { method: 'GET' },
  );

  return {
    session: normalizeSession(response.data?.session),
    messages: (response.data?.messages || []).map(normalizeMessage),
    pagination: {
      nextCursor: response.data?.pagination?.nextCursor ?? null,
      hasMore: Boolean(response.data?.pagination?.hasMore),
    },
  };
};

/**
 * Omitting sessionId opens a new conversation server-side, so the app never has
 * to create an empty chat up front.
 */
const sendJadeMessage = async ({
  sessionId,
  text,
}: {
  sessionId?: string | null;
  text: string;
}): Promise<JadeSendResult> => {
  const response = await request<JadeSendResult>('/ask-jade/messages', {
    method: 'POST',
    body: JSON.stringify({
      ...(sessionId ? { sessionId } : {}),
      text: text.trim(),
    }),
  });

  return {
    sessionId: String(response.data?.sessionId ?? ''),
    title: String(response.data?.title ?? ''),
    userMessage: normalizeMessage(response.data?.userMessage),
    reply: normalizeMessage(response.data?.reply),
    limits: {
      turnsUsedToday: Number(response.data?.limits?.turnsUsedToday ?? 0),
      turnsPerDay: Number(response.data?.limits?.turnsPerDay ?? 0),
      resetAt: response.data?.limits?.resetAt ?? null,
    },
  };
};

const deleteJadeSession = async (sessionId: string): Promise<void> => {
  await request(`/ask-jade/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
};

export {
  deleteJadeSession,
  getJadeSessionThread,
  getJadeSessions,
  sendJadeMessage,
};
export type {
  JadeMessage,
  JadeMessageBlock,
  JadeMessageStatus,
  JadeSendResult,
  JadeSessionListPage,
  JadeSessionSummary,
  JadeSessionThread,
  JadeTurnLimits,
};
