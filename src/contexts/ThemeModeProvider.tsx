import { useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme } from "../theme";
import { ThemeModeContext, type ThemeMode } from "./ThemeModeContext";

const themes = { light: createAppTheme("light"), dark: createAppTheme("dark") };

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<ThemeMode>(() => {
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    try {
      const saved = localStorage.getItem("mip-theme-mode");
      if (saved === "light" || saved === "dark") return saved;
    } catch { return preferred; }
    return preferred;
  });

  function setMode(next: ThemeMode) {
    updateMode(next);
    try { localStorage.setItem("mip-theme-mode", next); } catch { return; }
  }

  return <ThemeModeContext.Provider value={{ mode, setMode }}>
    <ThemeProvider theme={themes[mode]}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  </ThemeModeContext.Provider>;
}