import { request } from "../utils/apiClient";
import {
  type CreateJournalPayload,
  type JournalEntry,
  type JournalEntryApiRecord,
  type JournalQuickAnalysis,
  type JournalTagSuggestions,
  type UpdateJournalPayload,
} from "../models/journalModels";

const createJournalEntry = async (payload: CreateJournalPayload) => {
  const requestBody = {
    title: payload.title.trim(),
    content: payload.content.trim(),
    type: payload.type?.trim() || "journal",
    aiPrompt: payload.aiPrompt?.trim() || undefined,
    images: payload.images || [],
    tags: payload.tags || [],
    isFavorite: payload.isFavorite ?? false,
  };

  if (__DEV__) {
    console.log("[journalService] createJournalEntry request", requestBody);
  }

  const response = await request<JournalEntry>("/journal/create_journal", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (__DEV__) {
    console.log("[journalService] createJournalEntry response", response.data);
  }

  return {
    ...response.data,
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || payload.tags || [],
    isFavorite: response.data.isFavorite ?? payload.isFavorite ?? false,
  };
};

const getJournalEntry = async (journalId: string) => {
  const response = await request<JournalEntry>(
    `/journal/get_journal_details?journalId=${encodeURIComponent(journalId)}`,
    {
      method: "GET",
    }
  );

  return {
    ...response.data,
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || [],
    isFavorite: response.data.isFavorite ?? false,
  };
};

const updateJournalEntry = async (payload: UpdateJournalPayload) => {
  const requestBody = {
    journalId: payload.journalId,
    title: payload.title.trim(),
    content: payload.content.trim(),
    type: payload.type?.trim() || "journal",
    aiPrompt: payload.aiPrompt?.trim() || undefined,
    images: payload.images || [],
    tags: payload.tags || [],
    isFavorite: payload.isFavorite ?? false,
  };

  if (__DEV__) {
    console.log("[journalService] updateJournalEntry request", requestBody);
  }

  const response = await request<JournalEntry>("/journal/edit_journal", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (__DEV__) {
    console.log("[journalService] updateJournalEntry response", response.data);
  }

  return {
    ...response.data,
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || payload.tags || [],
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

  if (__DEV__) {
    console.log("[journalService] toggleJournalFavorite request", requestBody);
  }

  const response = await request<JournalEntry>("/journal/toggle_favorite", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (__DEV__) {
    console.log("[journalService] toggleJournalFavorite response", response.data);
  }

  return {
    ...response.data,
    aiPrompt: response.data.aiPrompt ?? null,
    tags: response.data.tags || [],
    isFavorite: response.data.isFavorite ?? payload.isFavorite,
  };
};

const deleteJournalEntry = async (journalId: string) => {
  const response = await request<{}>("/journal/delete_journal", {
    method: "DELETE",
    body: JSON.stringify({ journalId }),
  });

  return response.data;
};

const getJournalEntries = async () => {
  const response = await request<JournalEntryApiRecord[]>("/journal/get_journals", {
    method: "GET",
  });

  return response.data.map(entry => ({
    ...entry,
    aiPrompt: entry.aiPrompt ?? null,
    tags: entry.tags || [],
    isFavorite: entry.isFavorite ?? false,
  }));
};

const suggestJournalTags = async (payload: {
  content: string;
  selectedTags?: string[];
  mood?: "amazing" | "good" | "okay" | "bad" | "terrible" | null;
}) => {
  const response = await request<JournalTagSuggestions>("/journal/suggest_tags", {
    method: "POST",
    body: JSON.stringify({
      content: payload.content.trim(),
      selectedTags: payload.selectedTags || [],
      mood: payload.mood || undefined,
    }),
  });

  return {
    tags: response.data.tags || [],
  };
};

const getJournalQuickAnalysis = async (journalId: string) => {
  const response = await request<JournalQuickAnalysis>("/journal/quick_analysis", {
    method: "POST",
    body: JSON.stringify({ journalId }),
  });

  return response.data;
};

export type { CreateJournalPayload, JournalEntry };
export {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  getJournalQuickAnalysis,
  getJournalEntries,
  suggestJournalTags,
  toggleJournalFavorite,
  updateJournalEntry,
};
