// src/modules/user/user.schemas.ts
import { z } from "zod";

// GET /get_journals
const getJournalsSchema = z.object({
  body: z.object({}),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /create_journal
const createJournalSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    // add anything else you actually use in controller
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// GET /get_journal_details;
const getJournalDetailsSchema = z.object({
  body: z.object({}),
  query: z.object({}).optional(),
  params: z
    .object({
      _id: z.string().min(1, "Journal ID is required"),
    })
    .optional(),
});

// POST /edit_journal
const editJournalSchema = z.object({
  body: z.object({
    _id: z.string().min(1, "Journal ID is required"),
    new_title: z.string().min(1, "Title is required").optional(),
    new_content: z.string().min(1, "Content is required").optional(),
    // add anything else you actually use in controller
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// DELETE /delete_journal
const deleteJournalSchema = z.object({
  body: z.object({
    _id: z.string().min(1, "Journal ID is required"),
  }), // JWT identifies user
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  getJournalsSchema,
  createJournalSchema,
  getJournalDetailsSchema,
  editJournalSchema,
  deleteJournalSchema,
};
