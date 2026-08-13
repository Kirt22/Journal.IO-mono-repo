import { useAppStore } from "../store/appStore";

type HapticEvent =
  | "animationCue"
  | "authIntroMerge"
  | "authIntroProgress"
  | "authIntroReveal"
  | "authIntroWelcome"
  | "welcome"
  | "optionSelected"
  | "themeSelected"
  | "personalizationComplete"
  | "primaryAction"
  | "secondaryAction"
  | "screenTransition"
  | "streakFlame"
  | "bottomSheet"
  | "legal"
  | "back";

type PulsarPresets = typeof import("react-native-pulsar").Presets;
type PulsarSettings = typeof import("react-native-pulsar").Settings;

let cachedPresets: PulsarPresets | null | undefined;
let cachedSettings: PulsarSettings | null | undefined;
let lastHapticAt = 0;
let hasConfiguredPulsar = false;

const HAPTIC_THROTTLE_MS = 220;
const AUTH_INTRO_REVEAL_THROTTLE_MS = 120;

const getPulsarModule = () => {
  if (cachedPresets !== undefined) {
    return {
      Presets: cachedPresets,
      Settings: cachedSettings,
    };
  }

  try {
    // Lazy load so Jest/dev environments without native modules fail softly.
    // TODO Phase 3: tune Pulsar custom patterns once final onboarding haptics are locked.
    const pulsarModule = require("react-native-pulsar") as {
      Presets: PulsarPresets;
      Settings: PulsarSettings;
    };

    cachedPresets = pulsarModule.Presets;
    cachedSettings = pulsarModule.Settings;
  } catch {
    cachedPresets = null;
    cachedSettings = null;
  }

  return {
    Presets: cachedPresets,
    Settings: cachedSettings,
  };
};

const configurePulsar = (settings: PulsarSettings | null | undefined) => {
  if (hasConfiguredPulsar || !settings) {
    return;
  }

  try {
    settings.enableSound(false);
    hasConfiguredPulsar = true;
  } catch {
    // Keep haptics optional if Pulsar settings are unavailable in a test/dev runtime.
  }
};

const playPulsarPreset = (event: HapticEvent, presets: PulsarPresets) => {
  switch (event) {
    case "authIntroMerge":
      presets.System.impactHeavy();
      break;
    case "authIntroProgress":
    case "authIntroWelcome":
      presets.System.impactSoft();
      break;
    case "authIntroReveal":
      presets.System.selection();
      break;
    case "streakFlame":
      presets.ignition();
      break;
    case "animationCue":
    case "back":
    case "bottomSheet":
    case "legal":
    case "optionSelected":
    case "personalizationComplete":
    case "primaryAction":
    case "screenTransition":
    case "secondaryAction":
    case "themeSelected":
    case "welcome":
    default:
      presets.System.selection();
      break;
  }
};

const getHapticThrottleMs = (event: HapticEvent) =>
  event === "authIntroReveal"
    ? AUTH_INTRO_REVEAL_THROTTLE_MS
    : HAPTIC_THROTTLE_MS;

const triggerHaptic = async (event: HapticEvent) => {
  if (!useAppStore.getState().hapticsEnabled) {
    return undefined;
  }

  const now = Date.now();

  if (now - lastHapticAt < getHapticThrottleMs(event)) {
    return undefined;
  }

  const { Presets: presets, Settings: settings } = getPulsarModule();

  if (!presets) {
    return undefined;
  }

  try {
    configurePulsar(settings);
    playPulsarPreset(event, presets);
    lastHapticAt = now;
  } catch {
    // Haptics should never block onboarding if the native module is unavailable.
  }

  return undefined;
};

const stopHaptics = async () => {
  const { Settings: settings } = getPulsarModule();

  if (!settings) {
    return undefined;
  }

  try {
    settings.stopHaptics();
  } catch {
    // Stopping a completed haptic should never affect the celebration flow.
  }

  return undefined;
};

export { stopHaptics, triggerHaptic };
export type { HapticEvent };
