import { request } from '../utils/apiClient';
import {
  type CreateJournalPayload,
  type JournalEntry,
  type JournalEntryApiRecord,
  type JournalEntryPage,
  type JournalEntryPageApiRecord,
  type JournalQuickAnalysis,
  type JournalTagSuggestions,
  type UpdateJournalPayload,
} from '../models/journalModels';
import type { GuidedReflectionSessionAnalysisResponse } from './guidedReflectionService';
import { normalizeJournalEntryKind } from '../utils/journalEntryKind';

const normalizeJournalEntry = (entry: JournalEntryApiRecord): JournalEntry => ({
  ...entry,
  entryKind: normalizeJournalEntryKind(entry.entryKind, entry.title),
  aiPrompt: entry.aiPrompt ?? null,
  tags: entry.tags || [],
  detectedTopics: entry.detectedTopics || [],
  detectedMood: entry.detectedMood ?? null,
  isFavorite: entry.isFavorite ?? false,
});

const createJournalEntry = async (payload: CreateJournalPayload) => {
  const requestBody = {
    title: payload.title.trim(),
    content: payload.content.trim(),
    type: payload.type || 'open_ended',
    entryKind: payload.entryKind,
    aiPrompt: payload.aiPrompt?.trim() || undefined,
    images: payload.images || [],
    tags: payload.tags || [],
    isFavorite: payload.isFavorite ?? false,
  };

  const response = await request<JournalEntry>('/journal/create_journal', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  return {
    ...response.data,
    entryKind: normalizeJournalEntryKind(
      response.data.entryKind,
      response.data.title,
    ),
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || payload.tags || [],
    detectedTopics: response.data.detectedTopics || [],
    detectedMood: response.data.detectedMood ?? null,
    isFavorite: response.data.isFavorite ?? payload.isFavorite ?? false,
  };
};

const getJournalEntry = async (journalId: string) => {
  const response = await request<JournalEntry>(
    `/journal/get_journal_details?journalId=${encodeURIComponent(journalId)}`,
    {
      method: 'GET',
    },
  );

  return {
    ...response.data,
    entryKind: normalizeJournalEntryKind(
      response.data.entryKind,
      response.data.title,
    ),
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || [],
    detectedTopics: response.data.detectedTopics || [],
    detectedMood: response.data.detectedMood ?? null,
    isFavorite: response.data.isFavorite ?? false,
  };
};

const updateJournalEntry = async (payload: UpdateJournalPayload) => {
  const requestBody = {
    journalId: payload.journalId,
    title: payload.title.trim(),
    content: payload.content.trim(),
    type: payload.type || 'open_ended',
    aiPrompt: payload.aiPrompt?.trim() || undefined,
    images: payload.images || [],
    tags: payload.tags || [],
    isFavorite: payload.isFavorite ?? false,
  };

  const response = await request<JournalEntry>('/journal/edit_journal', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  return {
    ...response.data,
    entryKind: normalizeJournalEntryKind(
      response.data.entryKind,
      response.data.title,
    ),
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || payload.tags || [],
    detectedTopics: response.data.detectedTopics || [],
    detectedMood: response.data.detectedMood ?? null,
    isFavorite: response.data.isFavorite ?? payload.isFavorite ?? false,
  };
};

const toggleJournalFavorite = async (payload: {
  journalId: string;
  isFavorite: boolean;
}) => {
  const requestBody = {
    journalId: payload.journalId,
    isFavorite: payload.isFavorite,
  };

  const response = await request<JournalEntry>('/journal/toggle_favorite', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  return {
    ...response.data,
    entryKind: normalizeJournalEntryKind(
      response.data.entryKind,
      response.data.title,
    ),
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || [],
    detectedTopics: response.data.detectedTopics || [],
    detectedMood: response.data.detectedMood ?? null,
    isFavorite: response.data.isFavorite ?? payload.isFavorite,
  };
};

const deleteJournalEntry = async (journalId: string) => {
  const response = await request<{}>('/journal/delete_journal', {
    method: 'DELETE',
    body: JSON.stringify({ journalId }),
  });

  return response.data;
};

type GetJournalEntriesPageInput = {
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
};

const getJournalEntriesPage = async ({
  limit = 10,
  cursor,
  from,
  to,
}: GetJournalEntriesPageInput = {}): Promise<JournalEntryPage> => {
  const params = [
    ['limit', String(limit)],
    ...(cursor ? [['cursor', cursor]] : []),
    ...(from ? [['from', from]] : []),
    ...(to ? [['to', to]] : []),
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const response = await request<JournalEntryPageApiRecord>(
    `/journal/get_journals?${params}`,
    {
      method: 'GET',
    },
  );

  return {
    ...response.data,
    entries: response.data.entries.map(normalizeJournalEntry),
  };
};

const getJournalEntries = async () => {
  const entries: JournalEntry[] = [];
  let cursor: string | undefined;

  do {
    const page = await getJournalEntriesPage({
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });
    entries.push(...page.entries);
    cursor = page.pagination.nextCursor || undefined;
  } while (cursor);

  return entries;
};

const suggestJournalTags = async (payload: {
  content: string;
  selectedTags?: string[];
  mood?: 'amazing' | 'good' | 'okay' | 'bad' | 'terrible' | null;
}) => {
  const response = await request<JournalTagSuggestions>(
    '/journal/suggest_tags',
    {
      method: 'POST',
      body: JSON.stringify({
        content: payload.content.trim(),
        selectedTags: payload.selectedTags || [],
        mood: payload.mood || undefined,
      }),
    },
  );

  return {
    tags: response.data.tags || [],
  };
};

const getJournalQuickAnalysis = async (journalId: string) => {
  const response = await request<JournalQuickAnalysis>(
    '/journal/quick_analysis',
    {
      method: 'POST',
      body: JSON.stringify({ journalId }),
    },
  );

  return response.data;
};

const getJournalSessionAnalysis = async (journalId: string) => {
  const response = await request<GuidedReflectionSessionAnalysisResponse>(
    '/journal/session_analysis',
    {
      method: 'POST',
      body: JSON.stringify({ journalId }),
    },
  );

  return response.data;
};

export type { CreateJournalPayload, JournalEntry };
export {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  getJournalQuickAnalysis,
  getJournalSessionAnalysis,
  getJournalEntries,
  getJournalEntriesPage,
  suggestJournalTags,
  toggleJournalFavorite,
  updateJournalEntry,
};
