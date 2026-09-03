// src/modules/user/user.schemas.ts
import { z } from "zod";

// GET /get_journals
const getJournalsSchema = z.object({
  body: z.object({}).optional(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(50).optional(),
      cursor: z.string().trim().min(1).max(512).optional(),
      from: z.string().datetime({ offset: true }).optional(),
      to: z.string().datetime({ offset: true }).optional(),
    })
    .superRefine((value, context) => {
      if (value.from && value.to && new Date(value.from) >= new Date(value.to)) {
        context.addIssue({
          code: "custom",
          message: "from must be earlier than to",
          path: ["from"],
        });
      }
    }),
  params: z.object({}).optional(),
});

// POST /create_journal
const createJournalSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    type: z.enum(["open_ended", "guided"]).optional(),
    entryKind: z.enum(["journal", "quick_thought"]).optional(),
    aiPrompt: z.string().min(1).optional(),
    // What the app itself wrote into `content` — section labels, its own
    // reflection, the questions it asked, any inserted writing prompt. Bounded
    // because it is client-supplied; the authorship helper only ever removes
    // these strings, so a bad value costs text, never adds it.
    appAuthoredSegments: z.array(z.string().min(1).max(600)).max(40).optional(),
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
    type: z.enum(["open_ended", "guided"]).optional(),
    aiPrompt: z.string().min(1).optional(),
    appAuthoredSegments: z.array(z.string().min(1).max(600)).max(40).optional(),
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

const getJournalQuickAnalysisSchema = z.object({
  body: z.object({
    journalId: z.string().trim().min(1, "Journal ID is required"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const getJournalSessionAnalysisSchema = z.object({
  body: z.object({
    journalId: z.string().trim().min(1, "Journal ID is required"),
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
  getJournalQuickAnalysisSchema,
  getJournalSessionAnalysisSchema,
};
