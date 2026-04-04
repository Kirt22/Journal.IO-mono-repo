import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import {
  createJournal,
  deleteJournal,
  getJournalDetails,
  getJournals,
  toggleJournalFavorite,
  updateJournal,
} from "./journal.service";
import { IUser } from "../../schema/user.schema";

const getJournalsController = async (req: Request, res: Response) => {
  try {
    const user: IUser = req.user;
    const userId = user._id;
    // const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const journals = await getJournals(userId.toString());

    return res.status(200).json(apiResponse(true, "Journals loaded", journals));
  } catch (error) {
    console.error("Error in getJournalsController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const createJournalController = async (
  req: Request & { user?: { _id?: string } },
  res: Response,
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const { title, content, type, aiPrompt, images, tags } = req.body;
    const journal = await createJournal({
      userId,
      title,
      content,
      type,
      aiPrompt,
      tags,
      images,
    });

    return res.status(201).json(apiResponse(true, "Journal created", journal));
  } catch (error) {
    console.error("Error in createJournalController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const getJournalDetailsController = async (
  req: Request & { user?: { _id?: string } },
  res: Response,
) => {
  try {
    const userId = req.user?._id?.toString();
    const journalId =
      typeof req.query.journalId === "string" ? req.query.journalId : "";

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const journal = await getJournalDetails({ userId, journalId });

    if (!journal) {
      return res.status(404).json(apiResponse(false, "Journal not found", {}));
    }

    return res.status(200).json(apiResponse(true, "Journal loaded", journal));
  } catch (error) {
    console.error("Error in getJournalDetailsController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const editJournalController = async (
  req: Request & { user?: { _id?: string } },
  res: Response,
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const { journalId, title, content, type, aiPrompt, images, tags, isFavorite } =
      req.body;
    const journal = await updateJournal({
      userId,
      journalId,
      title,
      content,
      type,
      aiPrompt,
      images,
      tags,
      isFavorite,
    });

    if (!journal) {
      return res.status(404).json(apiResponse(false, "Journal not found", {}));
    }

    return res.status(200).json(apiResponse(true, "Journal updated", journal));
  } catch (error) {
    console.error("Error in editJournalController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const toggleJournalFavoriteController = async (
  req: Request & { user?: { _id?: string } },
  res: Response,
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const { journalId, isFavorite } = req.body;
    const journal = await toggleJournalFavorite({
      userId,
      journalId,
      isFavorite,
    });

    if (!journal) {
      return res.status(404).json(apiResponse(false, "Journal not found", {}));
    }

    return res.status(200).json(apiResponse(true, "Journal updated", journal));
  } catch (error) {
    console.error("Error in toggleJournalFavoriteController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const deleteJournalController = async (
  req: Request & { user?: { _id?: string } },
  res: Response,
) => {
  try {
    const userId = req.user?._id?.toString();
    const journalId = req.body?.journalId;

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const deleted = await deleteJournal({ userId, journalId });

    if (!deleted) {
      return res.status(404).json(apiResponse(false, "Journal not found", {}));
    }

    return res.status(200).json(apiResponse(true, "Journal deleted", {}));
  } catch (error) {
    console.error("Error in deleteJournalController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

export {
  getJournalsController,
  createJournalController,
  getJournalDetailsController,
  editJournalController,
  toggleJournalFavoriteController,
  deleteJournalController,
};
