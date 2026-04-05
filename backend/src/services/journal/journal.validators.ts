// src/modules/user/user.schemas.ts
import { z } from "zod";

// GET /get_journals
const getJournalsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /create_journal
const createJournalSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    type: z.string().min(1).optional(),
    aiPrompt: z.string().min(1).optional(),
    images: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// GET /get_journal_details;
const getJournalDetailsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    journalId: z.string().min(1, "Journal ID is required"),
  }),
  params: z.object({}).optional(),
});

// POST /edit_journal
const editJournalSchema = z.object({
  body: z.object({
    journalId: z.string().min(1, "Journal ID is required"),
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    type: z.string().min(1).optional(),
    aiPrompt: z.string().min(1).optional(),
    images: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    isFavorite: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /toggle_favorite
const toggleJournalFavoriteSchema = z.object({
  body: z.object({
    journalId: z.string().min(1, "Journal ID is required"),
    isFavorite: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// DELETE /delete_journal
const deleteJournalSchema = z.object({
  body: z.object({
    journalId: z.string().min(1, "Journal ID is required"),
  }), // JWT identifies user
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /suggest_tags
const suggestJournalTagsSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1, "Content is required"),
    selectedTags: z.array(z.string().trim().min(1)).optional(),
    mood: z
      .enum(["amazing", "good", "okay", "bad", "terrible"])
      .optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  getJournalsSchema,
  createJournalSchema,
  getJournalDetailsSchema,
  editJournalSchema,
  toggleJournalFavoriteSchema,
  deleteJournalSchema,
  suggestJournalTagsSchema,
};
