import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";
import { getTheme, type AppTheme, type ThemeMode } from "./theme";

const ThemeContext = createContext<AppTheme>(getTheme("light"));

type ThemeProviderProps = PropsWithChildren<{
  modeOverride?: ThemeMode | null;
}>;

export function ThemeProvider({
  children,
  modeOverride = null,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const mode = modeOverride ?? (systemScheme === "dark" ? "dark" : "light");
  const value = useMemo(() => getTheme(mode), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
