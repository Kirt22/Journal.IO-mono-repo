import { journalModel, type IJournal } from "../../schema/journal.schema";
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
    tags: input.tags || [],
    images: input.images || [],
    isFavorite: false,
  });

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
    .findOneAndUpdate(
      { _id: input.journalId, userId: input.userId },
      {
        title: input.title.trim(),
        content: input.content.trim(),
        type: input.type?.trim() || "journal",
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.images ? { images: input.images } : {}),
        ...(typeof input.isFavorite === "boolean"
          ? { isFavorite: input.isFavorite }
          : {}),
      },
      { new: true }
    )
    .exec();

  if (!journal) {
    return null;
  }

  return serializeJournal(journal);
};

const toggleJournalFavorite = async (
  input: ToggleJournalFavoriteInput
): Promise<JournalEntryResponse | null> => {
  const journal = await journalModel
    .findOneAndUpdate(
      { _id: input.journalId, userId: input.userId },
      {
        isFavorite: input.isFavorite,
      },
      { new: true }
    )
    .exec();

  if (!journal) {
    return null;
  }

  return serializeJournal(journal);
};

const deleteJournal = async ({
  userId,
  journalId,
}: JournalLookupInput): Promise<boolean> => {
  const result = await journalModel
    .deleteOne({
      _id: journalId,
      userId,
    })
    .exec();

  return result.deletedCount > 0;
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
