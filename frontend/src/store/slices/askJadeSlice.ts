import { ApiError } from '../../utils/apiClient';
import {
  deleteJadeSession,
  getJadeSessionThread,
  getJadeSessions,
  sendJadeMessage,
  type JadeMessage,
  type JadeSessionSummary,
  type JadeTurnLimits,
} from '../../services/askJadeService';

/**
 * Ask Jade state lives in the store rather than in the screen because three
 * surfaces read it — the thread, the sessions panel, and the screen shell — and
 * because signing out has to wipe a user's conversations from memory. The
 * typewriter reveal stays screen-local; that is presentation, not state.
 */

export type JadeThreadMessage = JadeMessage & {
  /**
   * Set on an optimistic bubble whose send failed, so the screen can offer a
   * retry in place rather than dropping what the user wrote.
   */
  failed?: boolean;
};

export type AskJadeSliceState = {
  jadeSessionId: string | null;
  jadeMessages: JadeThreadMessage[];
  jadeSessions: JadeSessionSummary[];
  jadeSessionsCursor: string | null;
  jadeSessionsHasMore: boolean;
  jadeThreadCursor: string | null;
  jadeThreadHasMore: boolean;
  hasHydratedJadeSessions: boolean;
  isLoadingJadeThread: boolean;
  isLoadingOlderJadeMessages: boolean;
  isLoadingJadeSessions: boolean;
  isSendingJadeMessage: boolean;
  jadeThreadError: string | null;
  jadeSessionsError: string | null;
  jadeLocked: boolean;
  jadeLimits: JadeTurnLimits | null;
  jadeLimitResetAt: string | null;
  startNewJadeChat: () => void;
  openJadeSession: (sessionId: string) => Promise<void>;
  loadOlderJadeMessages: () => Promise<void>;
  sendJadeChatMessage: (text: string) => Promise<boolean>;
  loadJadeSessions: (options?: { refresh?: boolean }) => Promise<void>;
  loadMoreJadeSessions: () => Promise<void>;
  removeJadeSession: (sessionId: string) => Promise<void>;
  clearJade: () => void;
};

type AskJadeState = Pick<
  AskJadeSliceState,
  | 'jadeSessionId'
  | 'jadeMessages'
  | 'jadeSessions'
  | 'jadeSessionsCursor'
  | 'jadeSessionsHasMore'
  | 'jadeThreadCursor'
  | 'jadeThreadHasMore'
  | 'hasHydratedJadeSessions'
  | 'isLoadingJadeThread'
  | 'isLoadingOlderJadeMessages'
  | 'isLoadingJadeSessions'
  | 'isSendingJadeMessage'
  | 'jadeThreadError'
  | 'jadeSessionsError'
  | 'jadeLocked'
  | 'jadeLimits'
  | 'jadeLimitResetAt'
>;

type AskJadeSliceSetState = (
  updater:
    | Partial<AskJadeState>
    | ((state: AskJadeState) => Partial<AskJadeState>),
) => void;

type AskJadeSliceGetState = () => AskJadeState;

const GENERIC_ERROR = "Jade couldn't reply just then. Try again in a moment.";

/** Entitlements can lapse mid-session, so 403 flips the screen to locked. */
const isPremiumRequiredError = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 403 || error.code === 'PREMIUM_REQUIRED');

const isTurnLimitError = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 429 || error.code === 'JADE_TURN_LIMIT');

const readErrorMessage = (error: unknown): string =>
  error instanceof ApiError && error.message ? error.message : GENERIC_ERROR;

const readResetAt = (error: unknown): string | null => {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const details = error.details as { resetAt?: unknown } | undefined;
  return typeof details?.resetAt === 'string' ? details.resetAt : null;
};

export const createInitialAskJadeSliceState = (): AskJadeState => ({
  jadeSessionId: null,
  jadeMessages: [],
  jadeSessions: [],
  jadeSessionsCursor: null,
  jadeSessionsHasMore: false,
  jadeThreadCursor: null,
  jadeThreadHasMore: false,
  hasHydratedJadeSessions: false,
  isLoadingJadeThread: false,
  isLoadingOlderJadeMessages: false,
  isLoadingJadeSessions: false,
  isSendingJadeMessage: false,
  jadeThreadError: null,
  jadeSessionsError: null,
  jadeLocked: false,
  jadeLimits: null,
  jadeLimitResetAt: null,
});

export const createAskJadeSlice = (
  set: AskJadeSliceSetState,
  get: AskJadeSliceGetState,
): AskJadeSliceState => ({
  ...createInitialAskJadeSliceState(),

  startNewJadeChat: () => {
    set({
      jadeSessionId: null,
      jadeMessages: [],
      jadeThreadCursor: null,
      jadeThreadHasMore: false,
      jadeThreadError: null,
    });
  },

  openJadeSession: async sessionId => {
    set({ isLoadingJadeThread: true, jadeThreadError: null });

    try {
      const thread = await getJadeSessionThread({ sessionId });

      set({
        jadeSessionId: thread.session.id || sessionId,
        jadeMessages: thread.messages,
        jadeThreadCursor: thread.pagination.nextCursor,
        jadeThreadHasMore: thread.pagination.hasMore,
        isLoadingJadeThread: false,
        jadeLocked: false,
      });
    } catch (error) {
      if (isPremiumRequiredError(error)) {
        set({ isLoadingJadeThread: false, jadeLocked: true });
        return;
      }

      // A chat that no longer exists should quietly become a new one rather
      // than stranding the user on an error.
      if (error instanceof ApiError && error.status === 404) {
        set({
          jadeSessionId: null,
          jadeMessages: [],
          jadeThreadCursor: null,
          jadeThreadHasMore: false,
          isLoadingJadeThread: false,
        });
        return;
      }

      set({
        isLoadingJadeThread: false,
        jadeThreadError: readErrorMessage(error),
      });
    }
  },

  loadOlderJadeMessages: async () => {
    const {
      jadeSessionId,
      jadeThreadCursor,
      jadeThreadHasMore,
      isLoadingOlderJadeMessages,
      isLoadingJadeThread,
    } = get();

    if (
      !jadeSessionId ||
      !jadeThreadCursor ||
      !jadeThreadHasMore ||
      isLoadingOlderJadeMessages ||
      isLoadingJadeThread
    ) {
      return;
    }

    set({ isLoadingOlderJadeMessages: true });

    try {
      const page = await getJadeSessionThread({
        sessionId: jadeSessionId,
        cursor: jadeThreadCursor,
      });

      set(state => ({
        // Older turns prepend — this list is reverse-paginated.
        jadeMessages: [...page.messages, ...state.jadeMessages],
        jadeThreadCursor: page.pagination.nextCursor,
        jadeThreadHasMore: page.pagination.hasMore,
        isLoadingOlderJadeMessages: false,
      }));
    } catch {
      set({ isLoadingOlderJadeMessages: false });
    }
  },

  sendJadeChatMessage: async text => {
    const trimmed = text.trim();
    if (!trimmed || get().isSendingJadeMessage) {
      return false;
    }

    const optimisticId = `local-${Date.now()}`;
    const optimistic: JadeThreadMessage = {
      id: optimisticId,
      seq: Number.MAX_SAFE_INTEGER,
      role: 'user',
      text: trimmed,
      status: 'ok',
      blocks: [],
      createdAt: new Date().toISOString(),
    };

    set(state => ({
      jadeMessages: [...state.jadeMessages, optimistic],
      isSendingJadeMessage: true,
      jadeThreadError: null,
    }));

    try {
      const result = await sendJadeMessage({
        sessionId: get().jadeSessionId,
        text: trimmed,
      });

      set(state => ({
        jadeSessionId: result.sessionId,
        jadeMessages: [
          ...state.jadeMessages.filter(message => message.id !== optimisticId),
          result.userMessage,
          result.reply,
        ],
        isSendingJadeMessage: false,
        jadeLimits: result.limits,
        jadeLimitResetAt: result.limits.resetAt,
      }));

      return true;
    } catch (error) {
      // Mark the bubble rather than removing it, so the screen can restore the
      // text into the composer and offer a retry.
      set(state => ({
        jadeMessages: state.jadeMessages.map(message =>
          message.id === optimisticId ? { ...message, failed: true } : message,
        ),
        isSendingJadeMessage: false,
        jadeLocked: isPremiumRequiredError(error) ? true : state.jadeLocked,
        jadeLimitResetAt: isTurnLimitError(error)
          ? readResetAt(error)
          : state.jadeLimitResetAt,
        jadeThreadError: isPremiumRequiredError(error)
          ? null
          : readErrorMessage(error),
      }));

      return false;
    }
  },

  loadJadeSessions: async options => {
    if (get().isLoadingJadeSessions && !options?.refresh) {
      return;
    }

    set({ isLoadingJadeSessions: true, jadeSessionsError: null });

    try {
      const page = await getJadeSessions({});

      set({
        jadeSessions: page.sessions,
        jadeSessionsCursor: page.pagination.nextCursor,
        jadeSessionsHasMore: page.pagination.hasMore,
        hasHydratedJadeSessions: true,
        isLoadingJadeSessions: false,
        jadeLocked: false,
      });
    } catch (error) {
      if (isPremiumRequiredError(error)) {
        set({ isLoadingJadeSessions: false, jadeLocked: true });
        return;
      }

      set({
        isLoadingJadeSessions: false,
        jadeSessionsError: readErrorMessage(error),
      });
    }
  },

  loadMoreJadeSessions: async () => {
    const { jadeSessionsCursor, jadeSessionsHasMore, isLoadingJadeSessions } =
      get();

    if (!jadeSessionsCursor || !jadeSessionsHasMore || isLoadingJadeSessions) {
      return;
    }

    set({ isLoadingJadeSessions: true, jadeSessionsError: null });

    try {
      const page = await getJadeSessions({ cursor: jadeSessionsCursor });

      set(state => ({
        jadeSessions: [...state.jadeSessions, ...page.sessions],
        jadeSessionsCursor: page.pagination.nextCursor,
        jadeSessionsHasMore: page.pagination.hasMore,
        isLoadingJadeSessions: false,
      }));
    } catch (error) {
      set({
        isLoadingJadeSessions: false,
        jadeSessionsError: readErrorMessage(error),
      });
    }
  },

  removeJadeSession: async sessionId => {
    const previous = get().jadeSessions;

    set(state => ({
      jadeSessions: state.jadeSessions.filter(
        session => session.id !== sessionId,
      ),
    }));

    try {
      await deleteJadeSession(sessionId);

      if (get().jadeSessionId === sessionId) {
        set({
          jadeSessionId: null,
          jadeMessages: [],
          jadeThreadCursor: null,
          jadeThreadHasMore: false,
        });
      }
    } catch (error) {
      // Put it back rather than pretending it is gone.
      set({
        jadeSessions: previous,
        jadeSessionsError: readErrorMessage(error),
      });
    }
  },

  clearJade: () => {
    set(createInitialAskJadeSliceState());
  },
});
