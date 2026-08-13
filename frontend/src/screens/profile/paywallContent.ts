import type { ImageSourcePropType } from "react-native";

export type PaywallBullet = {
  icon: ImageSourcePropType;
  text: string;
};

export type PaywallCopy = {
  eyebrow: string;
  headline: string;
  subhead: string;
  bullets: PaywallBullet[];
};

/**
 * Every placement shows the same list. The paywall sells one subscription, so
 * splitting the feature list per gate only made the same product look smaller
 * depending on where the user tapped — the headline is what stays contextual.
 */
export const PREMIUM_FEATURES: PaywallBullet[] = [
  {
    icon: require("../../assets/png/jade/jade-gem.png"),
    text: "Ask Jade anything — a support partner that knows your patterns, not a chatbot",
  },
  {
    icon: require("../../assets/png/navigation/icons8-brain-100.png"),
    text: "Your all-time mind map — every recurring pattern and how it shifts",
  },
  {
    icon: require("../../assets/png/entry/icons8-ai-100.png"),
    text: "Weekly AI insights that read your entries like a thoughtful therapist",
  },
  {
    icon: require("../../assets/png/entry/icons8-yoga-48.png"),
    text: "Unlimited deep guided sessions that go beneath the surface",
  },
  {
    icon: require("../../assets/png/paywall/icons8-write-100.png"),
    text: "A private mind map for every entry you write",
  },
  {
    icon: require("../../assets/png/paywall/icons8-goal-48.png"),
    text: "Auto goal suggestions drawn from what you actually write about",
  },
  {
    icon: require("../../assets/png/paywall/icons8-head-with-brain-48.png"),
    text: "Long-term memory so your insights build on everything you've written",
  },
  {
    icon: require("../../assets/png/onboarding/icons8-color-widgets-48.png"),
    text: "More Home Screen widgets for mood check-ins and quick thoughts",
  },
  {
    icon: require("../../assets/png/paywall/icons8-fingerprint-50.png"),
    text: "Face ID and biometric lock on your whole journal",
  },
  {
    icon: require("../../assets/png/paywall/icons8-hide-100.png"),
    text: "Hide journal entries and previews from anyone glancing over",
  },
];

const DEFAULT_COPY: PaywallCopy = {
  eyebrow: "JOURNAL.IO PREMIUM",
  headline: "See how you really think.",
  subhead:
    "Turn your reflections into a clear picture of how you feel, think, and grow.",
  bullets: PREMIUM_FEATURES,
};

// Copy is keyed by the placementKey each premium gate already passes, so the
// same paywall design feels personalised to whatever the user just tapped.
export const PAYWALL_CONTENT: Record<string, PaywallCopy> = {
  post_auth: DEFAULT_COPY,

  post_auth_exit_offer: {
    eyebrow: "SPECIAL YEARLY OFFER",
    headline: "Half off your first year.",
    subhead:
      "The full Journal.IO Premium year, at half the usual price. One payment, then it renews at the standard rate.",
    bullets: PREMIUM_FEATURES,
  },

  insights_ai_tab_locked: {
    eyebrow: "AI INSIGHTS",
    headline: "Your weekly read is ready.",
    subhead:
      "Premium reads your entries like a thoughtful therapist and maps how your patterns shift.",
    bullets: PREMIUM_FEATURES,
  },
  insights_interruptive: {
    eyebrow: "AI INSIGHTS",
    headline: "Your weekly read is ready.",
    subhead:
      "Premium turns your recent entries into a clear, therapist-style weekly insight.",
    bullets: PREMIUM_FEATURES,
  },

  home_ai_card_locked: {
    eyebrow: "DAILY INSIGHT",
    headline: "Unlock your daily insight.",
    subhead:
      "See the AI read on your entries right from Home — and the full picture behind it.",
    bullets: PREMIUM_FEATURES,
  },
  home_interruptive: {
    eyebrow: "JOURNAL.IO PREMIUM",
    headline: "See the whole picture.",
    subhead:
      "Premium keeps your insights, mind map, and deeper sessions open across the app.",
    bullets: PREMIUM_FEATURES,
  },

  entry_quick_analysis_locked: {
    eyebrow: "QUICK ANALYSIS",
    headline: "Get an instant read on this entry.",
    subhead:
      "Premium gives every entry a quick, therapist-style analysis — plus your full mind map.",
    bullets: PREMIUM_FEATURES,
  },

  new_entry_auto_tag_locked: {
    eyebrow: "SMART TAGS",
    headline: "Let AI surface your themes.",
    subhead:
      "Premium tags and connects the themes in your writing as you go.",
    bullets: PREMIUM_FEATURES,
  },
  new_entry_guided_locked: {
    eyebrow: "GUIDED REFLECTION",
    headline: "Go deeper with a little guidance.",
    subhead:
      "Premium offers adaptive questions, a supportive reflection summary, and optional next steps.",
    bullets: PREMIUM_FEATURES,
  },
  entry_session_analysis_locked: {
    eyebrow: "SESSION ANALYSIS",
    headline: "See what this entry was really about.",
    subhead:
      "Premium reads back the patterns in what you just wrote, without changing a word of it.",
    bullets: PREMIUM_FEATURES,
  },
  entry_mind_map_locked: {
    eyebrow: "ENTRY MIND MAP",
    headline: "Reveal the signals in this reflection.",
    subhead:
      "Premium connects this entry to a private Mind Map and offers small, optional goals you can keep.",
    bullets: PREMIUM_FEATURES,
  },

  ask_jade_locked: {
    eyebrow: "ASK JADE",
    headline: "Talk it through with someone who remembers.",
    subhead:
      "Premium lets you ask Jade about anything you've been writing, with the patterns from your own entries already in hand.",
    bullets: PREMIUM_FEATURES,
  },

  settings_hide_previews_locked: {
    eyebrow: "PRIVACY",
    headline: "Keep your reflections private.",
    subhead:
      "Premium hides entry previews and adds Face ID app lock.",
    bullets: PREMIUM_FEATURES,
  },
  settings_biometric_lock_locked: {
    eyebrow: "PRIVACY",
    headline: "Lock your journal behind Face ID.",
    subhead:
      "Premium adds a Face ID app lock and hidden entry previews.",
    bullets: PREMIUM_FEATURES,
  },
  settings_widgets_locked: {
    eyebrow: "HOME SCREEN WIDGETS",
    headline: "Check in without breaking your flow.",
    subhead:
      "Premium brings mood check-ins and quick thoughts to your Home Screen.",
    bullets: PREMIUM_FEATURES,
  },

  mind_map_locked: {
    eyebrow: "MIND MAP",
    headline: "See your full mind map.",
    subhead:
      "Premium reveals your recurring patterns and how they develop across everything you've written.",
    bullets: PREMIUM_FEATURES,
  },

  subscription_screen: {
    eyebrow: "JOURNAL.IO PREMIUM",
    headline: "Unlock Journal.IO Premium.",
    subhead: "Everything that turns journaling into real self-understanding.",
    bullets: PREMIUM_FEATURES,
  },
  profile_upgrade_banner: {
    eyebrow: "JOURNAL.IO PREMIUM",
    headline: "Unlock Journal.IO Premium.",
    subhead: "Everything that turns journaling into real self-understanding.",
    bullets: PREMIUM_FEATURES,
  },
};

export const getPaywallContent = (
  placementKey?: string | null,
  screenKey?: string | null
): PaywallCopy => {
  if (placementKey && PAYWALL_CONTENT[placementKey]) {
    return PAYWALL_CONTENT[placementKey];
  }
  // Fall back to a screen-key match if a placement wasn't mapped.
  if (screenKey && PAYWALL_CONTENT[screenKey]) {
    return PAYWALL_CONTENT[screenKey];
  }
  return DEFAULT_COPY;
};
