import { journalModel, type IJournal } from "../../schema/journal.schema";
import {
  syncJournalCreatedInsights,
  syncJournalDeletedInsights,
  syncJournalUpdatedInsights,
} from "../insights/insights.service";
import type {
  CreateJournalInput,
  JournalEntryResponse,
  JournalLookupInput,
  ToggleJournalFavoriteInput,
  UpdateJournalInput,
} from "../../types/journal.types";

const serializeJournal = (journal: IJournal): JournalEntryResponse => {
  const journalObject = journal.toObject();

  return {
    _id: journalObject._id.toString(),
    title: journalObject.title,
    content: journalObject.content,
    type: journalObject.type,
    aiPrompt: typeof journalObject.aiPrompt === "string" ? journalObject.aiPrompt : null,
    tags: Array.isArray(journalObject.tags) ? journalObject.tags : [],
    images: Array.isArray(journalObject.images) ? journalObject.images : [],
    isFavorite: Boolean(journalObject.isFavorite),
    createdAt: new Date(journalObject.createdAt).toISOString(),
    updatedAt: new Date(journalObject.updatedAt).toISOString(),
  };
};

const getJournals = async (userId: string): Promise<JournalEntryResponse[]> => {
  const journals = await journalModel
    .find({ userId })
    .sort({ createdAt: -1 })
    .exec();

  return journals.map(serializeJournal);
};

const createJournal = async (
  input: CreateJournalInput
): Promise<JournalEntryResponse> => {
  const journal = await journalModel.create({
    userId: input.userId,
    title: input.title.trim(),
    content: input.content.trim(),
    type: input.type?.trim() || "journal",
    aiPrompt: input.aiPrompt?.trim() || null,
    tags: input.tags || [],
    images: input.images || [],
    isFavorite: false,
  });

  try {
    await syncJournalCreatedInsights({
      userId: input.userId,
      content: journal.content,
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      createdAt: journal.createdAt,
    });
  } catch (error) {
    console.error("Failed to sync insights cache after journal creation:", error);
  }

  return serializeJournal(journal);
};

const getJournalDetails = async ({
  userId,
  journalId,
}: JournalLookupInput): Promise<JournalEntryResponse | null> => {
  const journal = await journalModel.findOne({ _id: journalId, userId }).exec();

  if (!journal) {
    return null;
  }

  return serializeJournal(journal);
};

const updateJournal = async (
  input: UpdateJournalInput
): Promise<JournalEntryResponse | null> => {
  const journal = await journalModel
    .findOne({ _id: input.journalId, userId: input.userId })
    .exec();

  if (!journal) {
    return null;
  }

  const previousJournalSnapshot = {
    userId: input.userId,
    content: journal.content,
    tags: journal.tags || [],
    isFavorite: Boolean(journal.isFavorite),
    createdAt: journal.createdAt,
  };

  journal.title = input.title.trim();
  journal.content = input.content.trim();
  journal.type = input.type?.trim() || "journal";

  if (typeof input.aiPrompt === "string") {
    journal.aiPrompt = input.aiPrompt.trim() || null;
  }

  if (input.tags) {
    journal.tags = input.tags;
  }

  if (input.images) {
    journal.images = input.images;
  }

  if (typeof input.isFavorite === "boolean") {
    journal.isFavorite = input.isFavorite;
  }

  await journal.save();

  try {
    await syncJournalUpdatedInsights({
      previousJournal: previousJournalSnapshot,
      nextJournal: {
        userId: input.userId,
        content: journal.content,
        tags: journal.tags || [],
        isFavorite: Boolean(journal.isFavorite),
        createdAt: journal.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to sync insights cache after journal update:", error);
  }

  return serializeJournal(journal);
};

const toggleJournalFavorite = async (
  input: ToggleJournalFavoriteInput
): Promise<JournalEntryResponse | null> => {
  const journal = await journalModel
    .findOne({ _id: input.journalId, userId: input.userId })
    .exec();

  if (!journal) {
    return null;
  }

  const previousJournalSnapshot = {
    userId: input.userId,
    content: journal.content,
    tags: journal.tags || [],
    isFavorite: Boolean(journal.isFavorite),
    createdAt: journal.createdAt,
  };

  journal.isFavorite = input.isFavorite;
  await journal.save();

  try {
    await syncJournalUpdatedInsights({
      previousJournal: previousJournalSnapshot,
      nextJournal: {
        userId: input.userId,
        content: journal.content,
        tags: journal.tags || [],
        isFavorite: Boolean(journal.isFavorite),
        createdAt: journal.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Failed to sync insights cache after favorite toggle:",
      error
    );
  }

  return serializeJournal(journal);
};

const deleteJournal = async ({
  userId,
  journalId,
}: JournalLookupInput): Promise<boolean> => {
  const journal = await journalModel
    .findOneAndDelete({
      _id: journalId,
      userId,
    })
    .exec();

  if (!journal) {
    return false;
  }

  try {
    await syncJournalDeletedInsights({
      userId,
      content: journal.content,
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      createdAt: journal.createdAt,
    });
  } catch (error) {
    console.error("Failed to sync insights cache after journal deletion:", error);
  }

  return true;
};

export type {
  CreateJournalInput,
  JournalEntryResponse,
  JournalLookupInput,
  ToggleJournalFavoriteInput,
  UpdateJournalInput,
};
export {
  createJournal,
  deleteJournal,
  getJournalDetails,
  getJournals,
  serializeJournal,
  toggleJournalFavorite,
  updateJournal,
};
