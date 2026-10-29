import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

/** The cookie that keeps the choice, so the server can render the toggle that matches it. */
export const THEME_COOKIE = "theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** A cookie value as a theme. Anything else, or no cookie, follows the system. */
export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Sets the `dark` class from the cookie before the page paints, so it never flashes the wrong
 * theme. Render it at the top of `<head>`. Only this script knows the system theme on first load.
 */
export const themeScript = `(function(){var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);var t=m?m[1]:matchMedia("${DARK_QUERY}").matches?"dark":"light";var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t})()`;

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

/**
 * Holds the theme and keeps the `dark` class on `<html>` in step with it. Give it the theme from
 * the cookie, so the server and the browser render the same thing.
 */
export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(next: Theme) {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setThemeState(next);
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
