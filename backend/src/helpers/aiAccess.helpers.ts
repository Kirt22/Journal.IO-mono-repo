import { getUserAiAccessState } from "./openai.helpers";

class PremiumFeatureRequiredError extends Error {
  constructor() {
    super("This feature is available with Premium.");
    this.name = "PremiumFeatureRequiredError";
  }
}

/**
 * Shared premium gate used by every AI-backed reflection surface
 * (weekly analysis, the global Mind Map, and per-entry Mind Map scoring).
 * Throws PremiumFeatureRequiredError so controllers can map it to a 403.
 *
 * Dev/testing bypass: set AI_ALLOW_NON_PREMIUM=true to skip the premium check so
 * the AI surfaces can be exercised without a live subscription. Never set this
 * in production — flip it off to enforce premium.
 */
const ensureAiAnalysisEnabled = async (userId: string) => {
  const accessState = await getUserAiAccessState(userId);
  const allowNonPremium = process.env.AI_ALLOW_NON_PREMIUM === "true";

  if (!accessState.isPremium && !allowNonPremium) {
    throw new PremiumFeatureRequiredError();
  }
};

export {
  PremiumFeatureRequiredError,
  ensureAiAnalysisEnabled,
};
