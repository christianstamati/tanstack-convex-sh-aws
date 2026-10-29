import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { parseTheme, THEME_COOKIE } from "@workspace/ui/components/theme-provider";

/** The theme the visitor chose, from the cookie, on the server and in the browser. */
export const getTheme = createIsomorphicFn()
  .server(() => parseTheme(getCookie(THEME_COOKIE)))
  .client(() =>
    parseTheme(document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`))?.[1]),
  );
