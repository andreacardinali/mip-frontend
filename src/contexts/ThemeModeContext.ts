import { createContext } from "react";

export type ThemeMode = "light" | "dark";

export const ThemeModeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}>({
  mode: "light",
  setMode: () => { throw new Error("ThemeModeProvider is missing"); },
});