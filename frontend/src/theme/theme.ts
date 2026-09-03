export {
  fontFamilies,
  resolveFontFamily,
  typography,
  type FontRole,
  type TypographyToken,
} from './typography';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference =
  | ThemeMode
  | 'warm_cream'
  | 'midnight_calm'
  | 'soft_peach'
  | 'forest'
  | 'sky_blue'
  // Kept only to restore a previously selected palette as Sky Blue.
  | 'minimal_grey';

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  inputBackground: string;
  success: string;
  successForeground: string;
  apple: string;
  appleForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  destructive: string;
  destructiveForeground: string;
};

export type AppTheme = {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: ThemeColors;
};

const lightColors: ThemeColors = {
  background: '#FDFCFB',
  foreground: '#2D2A26',
  card: '#FFFFFF',
  cardForeground: '#2D2A26',
  primary: '#E87461',
  primaryForeground: '#FFFFFF',
  secondary: '#F5F1ED',
  secondaryForeground: '#2D2A26',
  muted: '#EBE7E3',
  mutedForeground: '#837D77',
  accent: '#FFF5F2',
  accentForeground: '#2D2A26',
  border: '#E5DFD9',
  inputBackground: '#F9F7F5',
  success: '#6BAA75',
  successForeground: '#FFFFFF',
  apple: '#000000',
  appleForeground: '#FFFFFF',
  warning: '#E89B3C',
  warningForeground: '#FFFFFF',
  info: '#5B9BD5',
  infoForeground: '#FFFFFF',
  destructive: '#D4183D',
  destructiveForeground: '#FFFFFF',
};

const darkColors: ThemeColors = {
  background: '#1A1816',
  foreground: '#F5F1ED',
  card: '#2D2A26',
  cardForeground: '#F5F1ED',
  primary: '#FF8A75',
  primaryForeground: '#1A1816',
  secondary: '#3A3732',
  secondaryForeground: '#F5F1ED',
  muted: '#3A3732',
  mutedForeground: '#A39D96',
  accent: '#443F3A',
  accentForeground: '#F5F1ED',
  border: '#3A3732',
  inputBackground: '#2D2A26',
  success: '#7BC786',
  successForeground: '#1A1816',
  apple: '#000000',
  appleForeground: '#FFFFFF',
  warning: '#FFB75E',
  warningForeground: '#1A1816',
  info: '#74B9FF',
  infoForeground: '#1A1816',
  destructive: '#FF6B6B',
  destructiveForeground: '#1A1816',
};

const warmCreamColors = lightColors;

const midnightCalmColors: ThemeColors = darkColors;

const softPeachColors: ThemeColors = {
  ...lightColors,
  background: '#FFF7F2',
  card: '#FFFFFF',
  primary: '#F2A278',
  secondary: '#F8ECE5',
  muted: '#F0E2DA',
  mutedForeground: '#89776C',
  accent: '#FFECE3',
  border: '#EADAD2',
  inputBackground: '#FCF1EB',
};

const forestColors: ThemeColors = {
  ...lightColors,
  background: '#F8FAF5',
  foreground: '#263027',
  card: '#FFFFFF',
  cardForeground: '#263027',
  primary: '#6E8B6B',
  secondary: '#ECF1E8',
  secondaryForeground: '#263027',
  muted: '#E3EADB',
  mutedForeground: '#6E7569',
  accent: '#EEF5EA',
  accentForeground: '#263027',
  border: '#DDE5D7',
  inputBackground: '#F3F7EF',
};

const skyBlueColors: ThemeColors = {
  ...lightColors,
  background: '#F5FAFF',
  foreground: '#253746',
  card: '#FFFFFF',
  cardForeground: '#253746',
  primary: '#3B82C4',
  secondary: '#EAF4FD',
  secondaryForeground: '#253746',
  muted: '#DCEAF7',
  mutedForeground: '#668098',
  accent: '#EAF5FF',
  accentForeground: '#253746',
  border: '#D5E5F3',
  inputBackground: '#F0F8FF',
};

export const getTheme = (preference: ThemePreference): AppTheme => {
  switch (preference) {
    case 'dark':
    case 'midnight_calm':
      return {
        mode: 'dark',
        preference,
        colors: midnightCalmColors,
      };
    case 'soft_peach':
      return {
        mode: 'light',
        preference,
        colors: softPeachColors,
      };
    case 'forest':
      return {
        mode: 'light',
        preference,
        colors: forestColors,
      };
    case 'sky_blue':
    case 'minimal_grey':
      return {
        mode: 'light',
        preference,
        colors: skyBlueColors,
      };
    case 'light':
    case 'warm_cream':
    default:
      return {
        mode: 'light',
        preference,
        colors: warmCreamColors,
      };
  }
};
