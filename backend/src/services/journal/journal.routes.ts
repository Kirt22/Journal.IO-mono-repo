import { Router } from "express";
import * as journalController from "./journal.controllers";
import * as journalValidators from "./journal.validators";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";

const journalRouter: Router = Router();

/**
 * @route   POST /get_journals
 * @desc    Retrieves a list of journals.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.get(
  "/get_journals",
  verifyJwtToken,
  validateRequest(journalValidators.getJournalsSchema),
  journalController.getJournals
);

/**
 * @route   POST /create_journal
 * @desc    Creates a new journal entry.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.post(
  "/create_journal",
  verifyJwtToken,
  validateRequest(journalValidators.createJournalSchema),
  journalController.createJournal
);

/**
 * @route   POST /get_journal_details
 * @desc    Retrieves the journal details.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.get(
  "/get_journal_details",
  verifyJwtToken,
  validateRequest(journalValidators.getJournalDetailsSchema),
  journalController.getJournalDetails
);

/**
 * @route   POST /edit_journal
 * @desc    Edits an existing journal entry.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.post(
  "/edit_journal",
  verifyJwtToken,
  validateRequest(journalValidators.editJournalSchema),
  journalController.editJournal
);

/**
 * @route   DELETE /delete_journal
 * @desc    Deletes an existing journal entry.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.delete(
  "/delete_journal",
  verifyJwtToken,
  validateRequest(journalValidators.deleteJournalSchema),
  journalController.deleteJournal
);

export default journalRouter;
