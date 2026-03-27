import { request } from "../utils/apiClient";

type CreateJournalPayload = {
  title: string;
  content: string;
  type?: string;
  images?: string[];
  tags?: string[];
};

type JournalEntry = {
  _id: string;
  title: string;
  content: string;
  type: string;
  images: string[] | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

const MOCK_LATENCY_MS = 450;

const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const buildMockJournalEntry = (payload: CreateJournalPayload): JournalEntry => {
  const now = new Date().toISOString();
  const safeTitle = payload.title.trim() || "Untitled";

  return {
    _id: `journal-${Date.now()}`,
    title: safeTitle,
    content: payload.content.trim(),
    type: payload.type?.trim() || "journal",
    images: payload.images?.length ? payload.images : [],
    tags: payload.tags?.length ? payload.tags : [],
    createdAt: now,
    updatedAt: now,
  };
};

const createJournalEntry = async (payload: CreateJournalPayload) => {
  try {
    const response = await request<JournalEntry>("/journal/create_journal", {
      method: "POST",
      body: JSON.stringify({
        title: payload.title.trim(),
        content: payload.content.trim(),
        type: payload.type?.trim() || "journal",
        images: payload.images || [],
        tags: payload.tags || [],
      }),
    });

    return {
      ...response.data,
      tags: (response.data as Partial<JournalEntry>).tags || payload.tags || [],
    };
  } catch {
    await delay(MOCK_LATENCY_MS);
    return buildMockJournalEntry(payload);
  }
};

export type { CreateJournalPayload, JournalEntry };
export { createJournalEntry };
