import { Request, Response } from "express";
import { apiResponse, API_MESSAGES } from "../../helpers/commonHelper.helpers";
import {
  createFirstReflectionSummary,
  createGuidedReflectionGoDeeper,
  createGuidedReflectionGoalSuggestions,
  createGuidedReflectionSessionAnalysis,
} from "./guided-reflection.service";
import {
  getJournalSessionAnalysisSnapshot,
  isStaleSessionAnalysisSnapshot,
  persistJournalSessionAnalysisSnapshot,
} from "../journal/journalMetadata.service";

const createFirstReflectionSummaryController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const reflection = await createFirstReflectionSummary({
      userId,
      promptAnswers: req.body.promptAnswers,
      onboardingContext: req.body.onboardingContext,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your first reflection summary is ready.", reflection));
  } catch (error) {
    console.error("Error in createFirstReflectionSummaryController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const createGuidedReflectionGoDeeperController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const reflection = await createGuidedReflectionGoDeeper({
      userId,
      promptAnswers: req.body.promptAnswers,
      aiSummary: req.body.aiSummary,
      previousDeeperReflections: req.body.previousDeeperReflections,
      threadMessages: req.body.threadMessages,
      currentText: req.body.currentText,
      suggestionAction: req.body.suggestionAction,
      previousSignals: req.body.previousSignals,
      onboardingContext: req.body.onboardingContext,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your deeper reflection is ready.", reflection));
  } catch (error) {
    console.error("Error in createGuidedReflectionGoDeeperController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const createGuidedReflectionSessionAnalysisController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const storedAnalysis = req.body.journalId
      ? await getJournalSessionAnalysisSnapshot({
          userId,
          journalId: req.body.journalId,
        })
      : null;

    // A stored fallback is regenerated rather than replayed, matching
    // POST /journal/session_analysis. Without this the guided path would keep
    // serving generic copy from a transient AI outage forever.
    const isStale = isStaleSessionAnalysisSnapshot(
      storedAnalysis ? { analysis: storedAnalysis } : null
    );
    const replayableAnalysis = isStale ? null : storedAnalysis;

    const analysis = replayableAnalysis || await createGuidedReflectionSessionAnalysis({
      userId,
      journalId: req.body.journalId,
      promptAnswers: req.body.promptAnswers,
      aiSummary: req.body.aiSummary,
      threadMessages: req.body.threadMessages,
      sessionSignals: req.body.sessionSignals,
      onboardingContext: req.body.onboardingContext,
    });

    if (req.body.journalId && !replayableAnalysis) {
      const persistedAnalysis = await persistJournalSessionAnalysisSnapshot({
        userId,
        journalId: req.body.journalId,
        analysis,
        source: "guided",
        replaceExisting: isStale,
      });

      if (!persistedAnalysis) {
        return res
          .status(404)
          .json(apiResponse(false, "Entry not found.", {}));
      }

      return res
        .status(200)
        .json(apiResponse(true, "Your session analysis is ready.", persistedAnalysis));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your session analysis is ready.", analysis));
  } catch (error) {
    console.error("Error in createGuidedReflectionSessionAnalysisController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const createGuidedReflectionGoalSuggestionsController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const suggestions = await createGuidedReflectionGoalSuggestions({
      userId,
      promptAnswers: req.body.promptAnswers,
      aiSummary: req.body.aiSummary,
      threadMessages: req.body.threadMessages,
      sessionAnalysis: req.body.sessionAnalysis,
      onboardingContext: req.body.onboardingContext,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your goal suggestions are ready.", suggestions));
  } catch (error) {
    console.error("Error in createGuidedReflectionGoalSuggestionsController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  createFirstReflectionSummaryController,
  createGuidedReflectionGoDeeperController,
  createGuidedReflectionGoalSuggestionsController,
  createGuidedReflectionSessionAnalysisController,
};
