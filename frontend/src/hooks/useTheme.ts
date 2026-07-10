import { useEffect } from "react";
import { ThemePreference, updateTheme, User } from "../api/auth";

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Before login there's no per-user preference to read yet, so we fall back
 * to the OS/browser's prefers-color-scheme. Once a user is loaded, their
 * stored theme_preference takes over and stays in sync with the DB.
 */
export function useTheme(user: User | null | "loading") {
  useEffect(() => {
    if (user === "loading" || user === null) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
      return;
    }
    applyTheme(user.theme_preference);
  }, [user]);
}

export async function toggleTheme(
  user: User,
  setUser: (user: User) => void,
): Promise<void> {
  const next: ThemePreference = user.theme_preference === "dark" ? "light" : "dark";
  applyTheme(next); // optimistic
  setUser({ ...user, theme_preference: next });
  try {
    const updated = await updateTheme(next);
    setUser(updated);
  } catch {
    // Revert on failure.
    applyTheme(user.theme_preference);
    setUser(user);
  }
}
