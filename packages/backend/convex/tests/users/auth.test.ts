import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { internal } from "../../lib/api.refs";
import schema from "../../schema";
import { modules } from "../../test.setup";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logEmail", () => {
  test("logs the subject and the link, one line each", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.logEmail, {
      options: {},
      from: "onboarding@resend.dev",
      to: ["ada@example.com"],
      subject: "Validate your email address",
      text: "Open this link:\n\nhttp://localhost:3000/verify-email?code=abc_-1\n\nThe link stops working after 1 hour.",
    });

    const lines = log.mock.calls.map(([line]) => String(line));
    expect(lines).toEqual([
      "Email not sent (no RESEND_API_KEY) to ada@example.com: Validate your email address",
      "Open http://localhost:3000/verify-email?code=abc_-1 in the browser that asked for it.",
    ]);
  });

  test("stores the email in devMailbox, with its link and code", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.logEmail, {
      options: {},
      from: "onboarding@resend.dev",
      to: ["Ada@Example.com"],
      subject: "Reset your password",
      text: "Open this link to reset your password:\n\nhttp://localhost:3000/reset-password?code=xyz\n",
    });

    const email = await t.query(internal.devMailbox.latest, { to: "ada@example.com" });
    expect(email).toMatchObject({
      to: "ada@example.com",
      subject: "Reset your password",
      link: "http://localhost:3000/reset-password?code=xyz",
      code: "xyz",
    });
    expect(await t.query(internal.devMailbox.latest, { to: "bob@example.com" })).toBeNull();
    expect(await t.query(internal.devMailbox.list, {})).toHaveLength(1);
  });
});
