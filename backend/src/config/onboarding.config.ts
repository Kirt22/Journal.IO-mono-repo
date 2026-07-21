const CURRENT_ONBOARDING_VERSION = 2;
const DEFAULT_ONBOARDING_V2_RELEASE_CUTOFF = "2026-06-26T00:00:00.000Z";

const getOnboardingV2ReleaseCutoffDate = (): Date | null => {
  const rawCutoff =
    process.env.ONBOARDING_V2_RELEASE_CUTOFF ||
    DEFAULT_ONBOARDING_V2_RELEASE_CUTOFF;
  const parsedCutoff = new Date(rawCutoff);

  return Number.isNaN(parsedCutoff.getTime()) ? null : parsedCutoff;
};

export {
  CURRENT_ONBOARDING_VERSION,
  DEFAULT_ONBOARDING_V2_RELEASE_CUTOFF,
  getOnboardingV2ReleaseCutoffDate,
};
