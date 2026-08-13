import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const GUEST_KEY = "theme-guest";
const userKey = (userId: string) => `theme-${userId}`;

function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function getInitialTheme(): Theme {
  try {
    // Try guest first, then any user key
    const guest = localStorage.getItem(GUEST_KEY);
    if (guest === "light" || guest === "dark") return guest;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("theme-")) {
        const v = localStorage.getItem(k);
        if (v === "light" || v === "dark") return v;
      }
    }
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  // Apply theme to <html> whenever it changes
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // When the user logs in/out, load their preference (and migrate from guest if needed)
  useEffect(() => {
    try {
      if (user?.id) {
        const key = userKey(user.id);
        const saved = localStorage.getItem(key);
        if (saved === "light" || saved === "dark") {
          setThemeState(saved);
        } else {
          // Migrate current/guest theme to user key
          const guest = localStorage.getItem(GUEST_KEY);
          const initial = (guest === "light" || guest === "dark") ? guest : theme;
          localStorage.setItem(key, initial);
          setThemeState(initial);
        }
      } else {
        const guest = localStorage.getItem(GUEST_KEY);
        if (guest === "light" || guest === "dark") {
          setThemeState(guest);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const persist = useCallback((next: Theme) => {
    try {
      const key = user?.id ? userKey(user.id) : GUEST_KEY;
      localStorage.setItem(key, next);
    } catch {}
  }, [user?.id]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    persist(next);
  }, [persist]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
