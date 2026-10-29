/** The app's name: the tab title of the home page, and the end of every other page's. */
export const APP_NAME = "tanstack-convex-sh-aws";

/** What the app is, for search results and link previews. */
export const APP_DESCRIPTION =
  "A TanStack Start and Convex starter, with email and password sign-in, deployed to Cloudflare Workers.";

/**
 * The root route's meta tags: the defaults every page starts from. A page's own tag with the same
 * `name` or `property` replaces the root's. Link previews (Open Graph, X) read the `og:` tags.
 * To add a preview image, set `og:image` to an absolute URL of a 1200×630 PNG and switch
 * `twitter:card` to `summary_large_image`.
 */
export function siteMeta() {
  return [
    { title: APP_NAME },
    { name: "description", content: APP_DESCRIPTION },
    { property: "og:site_name", content: APP_NAME },
    { property: "og:type", content: "website" },
    { property: "og:title", content: APP_NAME },
    { property: "og:description", content: APP_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
  ];
}

/** A page's meta tags, for its route's `head`: its tab title, and the title in link previews. */
export function pageMeta(page: string, description?: string) {
  const title = `${page} · ${APP_NAME}`;
  return [
    { title },
    { property: "og:title", content: title },
    ...(description
      ? [
          { name: "description", content: description },
          { property: "og:description", content: description },
        ]
      : []),
  ];
}
