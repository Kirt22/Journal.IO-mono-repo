import { Router } from "express";
import * as journalController from "./journal.controllers";
import * as journalValidators from "./journal.validators";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";

const journalRouter: Router = Router();

/**
 * @route   GET /get_journals
 * @desc    Retrieves a list of journals.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.get(
  "/get_journals",
  verifyJwtToken,
  validateRequest(journalValidators.getJournalsSchema),
  journalController.getJournalsController
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
  journalController.createJournalController
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
  journalController.getJournalDetailsController
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
  journalController.editJournalController
);

/**
 * @route   POST /toggle_favorite
 * @desc    Toggles the favorite state of an existing journal entry.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.post(
  "/toggle_favorite",
  verifyJwtToken,
  validateRequest(journalValidators.toggleJournalFavoriteSchema),
  journalController.toggleJournalFavoriteController
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
  journalController.deleteJournalController
);

/**
 * @route   POST /suggest_tags
 * @desc    Suggests tags for journal content.
 * @access  Private (Requires JWT authentication)
 */
journalRouter.post(
  "/suggest_tags",
  verifyJwtToken,
  validateRequest(journalValidators.suggestJournalTagsSchema),
  journalController.suggestJournalTagsController
);

export default journalRouter;
