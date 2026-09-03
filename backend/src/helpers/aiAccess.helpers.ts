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
 * Throws PremiumFeatureRequiredError so controllers can map it to a 403. The
 * shared premium-entitlement helper owns the only development access override.
 */
const ensureAiAnalysisEnabled = async (userId: string) => {
  const accessState = await getUserAiAccessState(userId);

  if (!accessState.isPremium) {
    throw new PremiumFeatureRequiredError();
  }
};

export {
  PremiumFeatureRequiredError,
  ensureAiAnalysisEnabled,
};
