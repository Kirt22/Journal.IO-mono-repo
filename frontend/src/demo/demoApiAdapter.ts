import type { JournalEntry } from '../models/journalModels';
import type {
  JadeMessage,
  JadeSessionSummary,
} from '../services/askJadeService';
import type {
  ApiResponse,
  RequestAdapter,
  RequestAdapterInput,
} from '../utils/apiClient';
import { materializeDateKey, materializeDayOffset, materializeRelativeDates } from './dateMaterializer';

/**
 * The local calendar day an entry belongs to.
 *
 * Captured timestamps are materialized to ISO, which is UTC, while every date
 * key the app reasons about is local. Slicing the ISO string instead of reading
 * the local date silently moves any entry written near midnight onto the
 * neighbouring day: at UTC+4 a 00:40 entry lands on the previous day, opening a
 * hole in the streak on the exact nights a late-night scenario is about.
 */
const localDateKeyOf = (isoTimestamp: string) => {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp.slice(0, 10);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};
import { DemoMode } from './DemoMode';
import type { DemoCapturedData } from './demoTypes';
import { findNearestQuestionIndex } from './fuzzyMatch';

type JsonObject = Record<string, unknown>;

type DemoOverlay = {
  scenarioId: string;
  captured: DemoCapturedData;
  entries: JournalEntry[];
  goals: JsonObject[];
  moodCheckIns: JsonObject[];
  jadeSessions: JadeSessionSummary[];
  jadeMessages: Record<string, JadeMessage[]>;
  mutationSequence: number;
};

const SENSITIVE_READ_PREFIXES = [
  '/journal',
  '/guided-reflection',
  '/ask-jade',
  '/insights',
  '/mind-map',
  '/goals',
  '/mood',
  '/streaks',
  '/reminders',
  '/users/profile',
];

let overlay: DemoOverlay | null = null;

const success = <T>(data: T, message = 'Demo data loaded.'): ApiResponse<T> => ({
  success: true,
  message,
  data,
});

const readJsonBody = (body: RequestInit['body']): JsonObject => {
  if (typeof body !== 'string' || !body.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
};

const stableId = (scenarioId: string, value: string) => {
  let hash = 17;
  const source = `${scenarioId}:${value}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 2_147_483_647;
  }
  return `demo-${hash.toString(16).padStart(8, '0')}`;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const getOverlay = async () => {
  await DemoMode.ready;
  const scenario = DemoMode.activeScenario;
  if (!scenario) {
    overlay = null;
    return null;
  }

  if (overlay?.scenarioId === scenario.id) {
    return overlay;
  }

  const captured = materializeRelativeDates(clone(scenario.captured));

  // Keep the on-screen name continuous with the real account. Substituting here
  // rather than in the fixture means the captured object stays byte-for-byte
  // what the pipeline produced, and the swap survives a re-capture.
  if (DemoMode.realUserName && captured.profile) {
    (captured.profile as JsonObject).name = DemoMode.realUserName;
  }

  overlay = {
    scenarioId: scenario.id,
    captured,
    entries: clone(captured.journals.entries).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
    goals: clone(captured.goals),
    moodCheckIns: clone(captured.moodCheckIns),
    jadeSessions: [],
    jadeMessages: {},
    mutationSequence: 0,
  };
  return overlay;
};

const queryParams = (path: string) => {
  const query = path.split('?')[1] || '';
  return new URLSearchParams(query);
};

const findJournal = (state: DemoOverlay, journalId: string) =>
  state.entries.find(entry => entry._id === journalId) || null;

const journalPage = (state: DemoOverlay, path: string) => {
  const params = queryParams(path);
  const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 10));
  const from = params.get('from');
  const to = params.get('to');
  const filtered = state.entries.filter(entry => {
    if (from && entry.createdAt < from) return false;
    if (to && entry.createdAt >= to) return false;
    return true;
  });
  const cursor = params.get('cursor') || '';
  const start = cursor.startsWith('demo-') ? Number(cursor.slice(5)) || 0 : 0;
  const entries = filtered.slice(start, start + limit);
  const nextOffset = start + entries.length;

  return {
    entries,
    pagination: {
      nextCursor: nextOffset < filtered.length ? `demo-${nextOffset}` : null,
      hasMore: nextOffset < filtered.length,
      matchingCount: filtered.length,
    },
    summary: {
      totalEntries: state.entries.length,
      favoriteEntries: state.entries.filter(entry => entry.isFavorite).length,
    },
  };
};

const handleJournalRequest = (
  state: DemoOverlay,
  path: string,
  method: string,
  body: JsonObject,
) => {
  if (method === 'GET' && path.startsWith('/journal/get_journals')) {
    return success(journalPage(state, path), 'Journal entries loaded.');
  }
  if (method === 'GET' && path.startsWith('/journal/get_journal_details')) {
    const entry = findJournal(state, queryParams(path).get('journalId') || '');
    if (!entry) throw new Error('Demo journal entry was not found.');
    return success(entry, 'Journal entry loaded.');
  }
  if (method === 'POST' && path === '/journal/create_journal') {
    state.mutationSequence += 1;
    const createdAt = materializeDayOffset(0, '12:00');
    const entry: JournalEntry = {
      _id: stableId(state.scenarioId, `local-${state.mutationSequence}`),
      title: String(body.title || 'Untitled'),
      content: String(body.content || ''),
      type: String(body.type || 'open_ended'),
      entryKind: body.entryKind === 'quick_thought' ? 'quick_thought' : 'journal',
      aiPrompt: typeof body.aiPrompt === 'string' ? body.aiPrompt : null,
      images: Array.isArray(body.images) ? body.images.map(String) : [],
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      detectedTopics: [],
      detectedMood: null,
      isFavorite: Boolean(body.isFavorite),
      createdAt,
      updatedAt: createdAt,
    };
    state.entries.unshift(entry);
    return success(entry, 'Journal entry saved.');
  }
  if (method === 'POST' && path === '/journal/edit_journal') {
    const entry = findJournal(state, String(body.journalId || ''));
    if (!entry) throw new Error('Demo journal entry was not found.');
    Object.assign(entry, {
      title: String(body.title || entry.title),
      content: String(body.content || entry.content),
      type: String(body.type || entry.type),
      aiPrompt: typeof body.aiPrompt === 'string' ? body.aiPrompt : entry.aiPrompt,
      images: Array.isArray(body.images) ? body.images.map(String) : entry.images,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : entry.tags,
      isFavorite: Boolean(body.isFavorite),
      updatedAt: materializeDayOffset(0, '12:00'),
    });
    return success(entry, 'Journal entry updated.');
  }
  if (method === 'POST' && path === '/journal/toggle_favorite') {
    const entry = findJournal(state, String(body.journalId || ''));
    if (!entry) throw new Error('Demo journal entry was not found.');
    entry.isFavorite = Boolean(body.isFavorite);
    return success(entry, 'Favorite updated.');
  }
  if (method === 'DELETE' && path === '/journal/delete_journal') {
    const index = state.entries.findIndex(
      entry => entry._id === String(body.journalId || ''),
    );
    if (index >= 0) state.entries.splice(index, 1);
    return success({}, 'Journal entry deleted.');
  }
  if (method === 'POST' && path === '/journal/suggest_tags') {
    return success({ tags: Array.isArray(body.selectedTags) ? body.selectedTags : [] });
  }
  if (method === 'POST' && path === '/journal/quick_analysis') {
    const value = state.captured.journals.quickAnalysisByJournalId[String(body.journalId || '')];
    if (!value) throw new Error('No captured quick analysis exists for this entry.');
    return success(value);
  }
  if (method === 'POST' && path === '/journal/session_analysis') {
    const value = state.captured.journals.sessionAnalysisByJournalId[String(body.journalId || '')];
    if (!value) throw new Error('No captured session analysis exists for this entry.');
    return success(value);
  }
  return null;
};

const handleGuidedRequest = (
  state: DemoOverlay,
  path: string,
  body: JsonObject,
) => {
  const guided = state.captured.guidedFlow;
  if (path === '/guided-reflection/first-summary') return success(guided.firstSummary);
  if (path === '/guided-reflection/session-analysis') return success(guided.sessionAnalysis);
  if (path === '/guided-reflection/goal-suggestions') return success(guided.goalSuggestions);
  if (path === '/guided-reflection/go-deeper') {
    const action = String(body.suggestionAction || 'gentle_prompt') as keyof typeof guided.suggestions;
    return success(guided.suggestions[action] || guided.suggestions.gentle_prompt);
  }
  return null;
};

const resolveJadeAnswer = (state: DemoOverlay, text: string) => {
  const captured = state.captured.askJade;
  const index = findNearestQuestionIndex(
    text,
    captured.map(item => item.question),
  );
  return index >= 0 ? captured[index] : state.captured.askJadeFallback;
};

const handleJadeRequest = (
  state: DemoOverlay,
  path: string,
  method: string,
  body: JsonObject,
) => {
  if (
    method === 'GET' &&
    (path === '/ask-jade/sessions' || path.startsWith('/ask-jade/sessions?'))
  ) {
    return success({
      sessions: state.jadeSessions,
      pagination: { nextCursor: null, hasMore: false },
    });
  }
  if (method === 'GET' && path.startsWith('/ask-jade/sessions/')) {
    const sessionId = decodeURIComponent(path.split('/')[3].split('?')[0]);
    const session = state.jadeSessions.find(item => item.id === sessionId);
    if (!session) throw new Error('Demo Jade session was not found.');
    return success({
      session,
      messages: state.jadeMessages[sessionId] || [],
      pagination: { nextCursor: null, hasMore: false },
    });
  }
  if (method === 'POST' && path === '/ask-jade/messages') {
    const text = String(body.text || '').trim();
    const captured = resolveJadeAnswer(state, text);
    let sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId || !state.jadeMessages[sessionId]) {
      state.mutationSequence += 1;
      sessionId = stableId(state.scenarioId, `jade-${state.mutationSequence}`);
      state.jadeMessages[sessionId] = [];
    }
    const messages = state.jadeMessages[sessionId];
    const createdAt = materializeDayOffset(0, '12:00');
    const userMessage: JadeMessage = {
      id: stableId(sessionId, `user-${messages.length}`),
      seq: messages.length + 1,
      role: 'user',
      text,
      status: 'ok',
      blocks: [],
      createdAt,
    };
    const reply: JadeMessage = {
      ...clone(captured.reply),
      id: stableId(sessionId, `reply-${messages.length}`),
      seq: messages.length + 2,
      createdAt,
    };
    messages.push(userMessage, reply);
    const title = text.slice(0, 64) || 'Ask Jade';
    const summary: JadeSessionSummary = {
      id: sessionId,
      title,
      lastMessagePreview: reply.text.slice(0, 120),
      messageCount: messages.length,
      lastMessageAt: createdAt,
    };
    const existingIndex = state.jadeSessions.findIndex(item => item.id === sessionId);
    if (existingIndex >= 0) state.jadeSessions[existingIndex] = summary;
    else state.jadeSessions.unshift(summary);
    return success({
      sessionId,
      title,
      userMessage,
      reply,
      limits: { turnsUsedToday: messages.length / 2, turnsPerDay: 20, resetAt: null },
    });
  }
  if (method === 'DELETE' && path.startsWith('/ask-jade/sessions/')) {
    const sessionId = decodeURIComponent(path.split('/')[3]);
    delete state.jadeMessages[sessionId];
    state.jadeSessions = state.jadeSessions.filter(item => item.id !== sessionId);
    return success({});
  }
  return null;
};

const handleGoalRequest = (
  state: DemoOverlay,
  path: string,
  method: string,
  body: JsonObject,
) => {
  if (method === 'GET' && path.startsWith('/goals?')) {
    return success({ goals: state.goals });
  }
  if (method === 'POST' && path === '/goals/suggestions') {
    const journalId = String(body.journalId || '');
    return success(
      state.captured.goalSuggestionsByJournalId[journalId] || {
        journalId,
        suggestions: [],
      },
    );
  }
  if (method === 'POST' && path === '/goals') {
    state.mutationSequence += 1;
    const timestamp = materializeDayOffset(0, '12:00');
    const goal: JsonObject = {
      id: stableId(state.scenarioId, `goal-${state.mutationSequence}`),
      title: String(body.title || '').trim(),
      description: typeof body.description === 'string' ? body.description : null,
      icon: typeof body.icon === 'string' ? body.icon : 'target',
      iconSource: body.iconSource === 'fixed' ? 'fixed' : 'automatic',
      frequency: typeof body.frequency === 'string' ? body.frequency : 'as_needed',
      status: 'active',
      reminderEnabled: Boolean(body.reminderEnabled),
      reminderTime: typeof body.reminderTime === 'string' ? body.reminderTime : null,
      lastCompletedLocalDate: null,
      isCompletedForPeriod: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.goals.unshift(goal);
    return success(goal, 'Goal created.');
  }
  const match = path.match(/^\/goals\/([^/?]+)(?:\/(completion|status))?$/);
  if (!match) return null;
  const goalId = decodeURIComponent(match[1]);
  const goal = state.goals.find(item => item.id === goalId);
  if (!goal) throw new Error('Demo goal was not found.');
  if (method === 'DELETE') {
    state.goals = state.goals.filter(item => item.id !== goalId);
    return success({});
  }
  if (method === 'PATCH' && match[2] === 'completion') {
    goal.lastCompletedLocalDate = body.completed ? String(body.localDate || materializeDateKey(0)) : null;
    goal.isCompletedForPeriod = Boolean(body.completed);
  } else if (method === 'PATCH' && match[2] === 'status') {
    goal.status = body.status;
  } else if (method === 'PATCH') {
    Object.assign(goal, body);
  }
  goal.updatedAt = materializeDayOffset(0, '12:00');
  return success(goal, 'Goal updated.');
};

const handleMoodAndStreakRequest = (
  state: DemoOverlay,
  path: string,
  method: string,
  body: JsonObject,
) => {
  if (method === 'GET' && path === '/mood/today') {
    const today = materializeDateKey(0);
    const moodCheckIn = state.moodCheckIns.find(item => item.moodDateKey === today) || null;
    return success({ moodCheckIn, currentStreak: state.entries.length });
  }
  if (method === 'POST' && path === '/mood/check_in') {
    const dateKey = materializeDateKey(0);
    const timestamp = materializeDayOffset(0, '12:00');
    const moodCheckIn = {
      _id: stableId(state.scenarioId, `mood-${dateKey}`),
      mood: String(body.mood || 'okay'),
      moodDateKey: dateKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.moodCheckIns = state.moodCheckIns.filter(item => item.moodDateKey !== dateKey);
    state.moodCheckIns.push(moodCheckIn);
    return success({ moodCheckIn });
  }
  if (method === 'GET' && path === '/streaks/current') {
    return success({
      currentStreak: state.entries.length,
      bestStreak: state.entries.length,
      thisMonthEntries: state.entries.filter(entry =>
        localDateKeyOf(entry.createdAt).startsWith(materializeDateKey(0).slice(0, 7)),
      ).length,
      totalEntries: state.entries.length,
      lastEntryDateKey: materializeDateKey(0),
      hasEntryToday: true,
      achievements: [
        { key: 'first-entry', title: 'First entry', description: 'Started journaling', unlocked: true },
        { key: '7-day-streak', title: '7 day streak', description: 'Seven days in a row', unlocked: true },
        { key: '30-day-streak', title: '30 day streak', description: 'Thirty days in a row', unlocked: state.entries.length >= 30 },
        { key: '50-entries', title: '50 entries', description: 'Fifty reflections', unlocked: state.entries.length >= 50 },
        { key: '100-entries', title: '100 entries', description: 'One hundred reflections', unlocked: state.entries.length >= 100 },
      ],
    });
  }
  if (method === 'GET' && path.startsWith('/streaks/history')) {
    const days = Math.min(365, Math.max(1, Number(queryParams(path).get('days')) || 30));
    const entryDates = new Set(state.entries.map(entry => localDateKeyOf(entry.createdAt)));
    return success({
      days: Array.from({ length: days }, (_, index) => {
        const dayOffset = index - days + 1;
        const dateKey = materializeDateKey(dayOffset);
        const count = state.entries.filter(
          entry => localDateKeyOf(entry.createdAt) === dateKey,
        ).length;
        return { dateKey, count, hasEntry: entryDates.has(dateKey), isToday: dayOffset === 0 };
      }),
    });
  }
  return null;
};

export const demoRequestAdapter: RequestAdapter = async <T>(
  { path, method, options }: RequestAdapterInput,
): Promise<ApiResponse<T> | null> => {
  const state = await getOverlay();
  if (!state) return null;
  const body = readJsonBody(options.body);

  const handlers = [
    () => handleJournalRequest(state, path, method, body),
    () => path.startsWith('/guided-reflection/') ? handleGuidedRequest(state, path, body) : null,
    () => path.startsWith('/ask-jade/') ? handleJadeRequest(state, path, method, body) : null,
    () => path.startsWith('/goals') ? handleGoalRequest(state, path, method, body) : null,
    () => handleMoodAndStreakRequest(state, path, method, body),
  ];

  if (method === 'GET' && path === '/users/profile') {
    return success(state.captured.profile) as ApiResponse<T>;
  }
  if (method === 'GET' && path.startsWith('/insights/overview')) {
    return success(state.captured.insightsOverview) as ApiResponse<T>;
  }
  if (method === 'GET' && path.startsWith('/insights/ai-analysis')) {
    return success(state.captured.weeklyAnalysis) as ApiResponse<T>;
  }
  if (method === 'GET' && path.startsWith('/insights/mind-map/region/')) {
    const regionId = decodeURIComponent(path.split('/')[4]);
    const range = queryParams(path).get('range') || 'all_time';
    const value = state.captured.regionSeries[`${range}:${regionId}`];
    if (!value) throw new Error('No captured Mind Map series exists for this region.');
    return success(value) as ApiResponse<T>;
  }
  if (method === 'GET' && path.startsWith('/insights/mind-map')) {
    const range = (queryParams(path).get('range') || 'all_time') as keyof DemoCapturedData['mindMaps'];
    const value = state.captured.mindMaps[range];
    if (!value) throw new Error('No captured Mind Map exists for this range.');
    return success(value) as ApiResponse<T>;
  }
  if (method === 'GET' && path.startsWith('/mind-map/entry/')) {
    const journalId = decodeURIComponent(path.split('/')[3]);
    const value = state.captured.journals.entryMindMapByJournalId[journalId];
    if (!value) throw new Error('No captured entry Mind Map exists for this entry.');
    return success(value) as ApiResponse<T>;
  }

  for (const handle of handlers) {
    const response = handle();
    if (response) return response as ApiResponse<T>;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    throw new Error(`Demo Mode blocked a real ${method} request to ${path}.`);
  }
  if (SENSITIVE_READ_PREFIXES.some(prefix => path.startsWith(prefix))) {
    throw new Error(`Demo Mode has no fixture handler for ${path}.`);
  }
  return null;
};

export const resetDemoOverlayForTests = () => {
  overlay = null;
};
