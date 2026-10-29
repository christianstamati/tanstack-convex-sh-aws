import { createMiddleware, createStart } from "@tanstack/react-start";

// Pages are rendered as the user, so no cache may keep one and serve it to someone else.
const noStore = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const result = await next();
  result.response.headers.set("Cache-Control", "no-store");
  return result;
});

export const startInstance = createStart(() => ({ requestMiddleware: [noStore] }));
