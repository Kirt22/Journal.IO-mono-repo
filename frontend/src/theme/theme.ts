export type ThemeMode = "light" | "dark";

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
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  destructive: string;
  destructiveForeground: string;
};

export type AppTheme = {
  mode: ThemeMode;
  colors: ThemeColors;
};

const lightColors: ThemeColors = {
  background: "#FDFCFB",
  foreground: "#2D2A26",
  card: "#FFFFFF",
  cardForeground: "#2D2A26",
  primary: "#E87461",
  primaryForeground: "#FFFFFF",
  secondary: "#F5F1ED",
  secondaryForeground: "#2D2A26",
  muted: "#EBE7E3",
  mutedForeground: "#837D77",
  accent: "#FFF5F2",
  accentForeground: "#2D2A26",
  border: "#E5DFD9",
  inputBackground: "#F9F7F5",
  success: "#6BAA75",
  successForeground: "#FFFFFF",
  warning: "#E89B3C",
  warningForeground: "#FFFFFF",
  info: "#5B9BD5",
  infoForeground: "#FFFFFF",
  destructive: "#D4183D",
  destructiveForeground: "#FFFFFF",
};

const darkColors: ThemeColors = {
  background: "#1A1816",
  foreground: "#F5F1ED",
  card: "#2D2A26",
  cardForeground: "#F5F1ED",
  primary: "#FF8A75",
  primaryForeground: "#1A1816",
  secondary: "#3A3732",
  secondaryForeground: "#F5F1ED",
  muted: "#3A3732",
  mutedForeground: "#A39D96",
  accent: "#443F3A",
  accentForeground: "#F5F1ED",
  border: "#3A3732",
  inputBackground: "#2D2A26",
  success: "#7BC786",
  successForeground: "#1A1816",
  warning: "#FFB75E",
  warningForeground: "#1A1816",
  info: "#74B9FF",
  infoForeground: "#1A1816",
  destructive: "#FF6B6B",
  destructiveForeground: "#1A1816",
};

export const getTheme = (mode: ThemeMode): AppTheme => ({
  mode,
  colors: mode === "dark" ? darkColors : lightColors,
});

