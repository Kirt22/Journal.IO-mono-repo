import type { ThemeMode, ThemePreference } from '../../theme/theme';

type OnboardingV2Option = {
  id: string;
  label: string;
};

type OnboardingV2ThemeOption = OnboardingV2Option & {
  primaryColor: string;
};

type ReadyFeatureCard = {
  text: string;
};

export const REFERRAL_SOURCE_OPTIONS: OnboardingV2Option[] = [
  { id: 'app_store', label: 'App Store' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'x_twitter', label: 'X / Twitter' },
  { id: 'friend_family', label: 'Friend or family' },
  { id: 'reddit_community', label: 'Reddit / community' },
  { id: 'other', label: 'Other' },
];

export const AGE_RANGE_OPTIONS: OnboardingV2Option[] = [
  { id: '18_24', label: '18-24' },
  { id: '25_34', label: '25-34' },
  { id: '35_44', label: '35-44' },
  { id: '45_plus', label: '45+' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const PRIMARY_CONTEXT_OPTIONS: OnboardingV2Option[] = [
  { id: 'student', label: 'Student' },
  { id: 'working_professional', label: 'Working professional' },
  { id: 'founder_builder', label: 'Founder / building something' },
  { id: 'creative_work', label: 'Creative work' },
  { id: 'looking_for_work', label: 'Looking for work' },
  { id: 'other_prefer_not', label: 'Other / prefer not to say' },
];

export const REFLECTION_TONE_OPTIONS: OnboardingV2Option[] = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'direct', label: 'Direct' },
  { id: 'deep', label: 'Deep' },
  { id: 'motivating', label: 'Motivating' },
  { id: 'neutral', label: 'Neutral' },
];

export const SUPPORT_FOCUS_OPTIONS: OnboardingV2Option[] = [
  { id: 'stress', label: 'Stress' },
  { id: 'overthinking', label: 'Overthinking' },
  { id: 'low_mood', label: 'Low mood' },
  { id: 'loneliness', label: 'Loneliness' },
  { id: 'anger', label: 'Anger' },
  { id: 'focus', label: 'Focus' },
];

export const THEME_OPTIONS: OnboardingV2ThemeOption[] = [
  { id: 'warm_cream', label: 'Cream', primaryColor: '#E87461' },
  { id: 'midnight_calm', label: 'Midnight', primaryColor: '#FF8A75' },
  { id: 'soft_peach', label: 'Peach', primaryColor: '#F2A278' },
  { id: 'forest', label: 'Forest', primaryColor: '#6E8B6B' },
  { id: 'sky_blue', label: 'Sky Blue', primaryColor: '#3B82C4' },
];

export const getOnboardingThemeDefault = (
  mode: ThemeMode,
): ThemePreference =>
  mode === 'dark' ? 'midnight_calm' : 'warm_cream';

export const READY_FEATURE_CARDS: ReadyFeatureCard[] = [
  {
    text: 'Thoughtful questions shaped by your setup.',
  },
  {
    text: 'Your writing stays private and protected.',
  },
  {
    text: 'Your entries become insights over time.',
  },
];

export type { OnboardingV2Option, OnboardingV2ThemeOption, ReadyFeatureCard };
