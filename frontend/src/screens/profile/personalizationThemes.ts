import type { ThemePreference } from '../../theme/theme';

export type PersonalizationThemePreference = ThemePreference | 'system';

export type PersonalizationThemeOption = {
  color: string;
  description: string;
  label: string;
  value: PersonalizationThemePreference;
};

export function getPersonalizationThemeOptions(systemColor: string) {
  return [
    {
      value: 'system',
      label: 'System',
      description: 'Use device setting',
      color: systemColor,
    },
    {
      value: 'warm_cream',
      label: 'Light',
      description: 'Warm cream',
      color: '#E87461',
    },
    {
      value: 'midnight_calm',
      label: 'Dark',
      description: 'Midnight calm',
      color: '#FF8A75',
    },
    {
      value: 'soft_peach',
      label: 'Soft Peach',
      description: 'Soft and warm',
      color: '#F2A278',
    },
    {
      value: 'forest',
      label: 'Forest',
      description: 'Grounded green',
      color: '#6E8B6B',
    },
    {
      value: 'sky_blue',
      label: 'Sky Blue',
      description: 'Clear and calm',
      color: '#3B82C4',
    },
  ] satisfies PersonalizationThemeOption[];
}

export function getPersonalizationThemeSummary(
  preference: PersonalizationThemePreference,
  systemColor: string,
) {
  return (
    getPersonalizationThemeOptions(systemColor).find(
      option => option.value === preference,
    ) || getPersonalizationThemeOptions(systemColor)[0]
  );
}
