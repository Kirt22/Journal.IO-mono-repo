import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";

const getJournals = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in getJournals:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const createJournal = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in createJournal:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const getJournalDetails = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in getJournalDetails:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const editJournal = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in editJournal:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const deleteJournal = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in deleteJournal:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

export {
  getJournals,
  createJournal,
  getJournalDetails,
  editJournal,
  deleteJournal,
};
