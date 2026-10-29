import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api } from "../../lib/api.refs";
import { errors } from "../../lib/errors";
import schema from "../../schema";
import { modules } from "../../test.setup";

/** A test backend and a signed-in user. Convex Auth's tokens carry the user id as `subject`. */
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const signIn = async () => {
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    return t.withIdentity({ subject: userId });
  };
  return { t, signIn, user: await signIn() };
}

describe("notes", () => {
  test("creates and lists notes, newest first", async () => {
    const { user } = await setup();
    await user.mutation(api.notes.create, { text: "  first  " });
    await user.mutation(api.notes.create, { text: "second" });

    const notes = await user.query(api.notes.list, {});
    expect(notes.map((note) => note.text)).toEqual(["second", "first"]);
  });

  test("rejects empty notes", async () => {
    const { user } = await setup();
    const error = await user.mutation(api.notes.create, { text: "   " }).catch((e) => e);
    expect(errors.is(error, "invalid_length")).toBe(true);
  });

  test("deletes a note", async () => {
    const { user } = await setup();
    const id = await user.mutation(api.notes.create, { text: "gone soon" });

    await user.mutation(api.notes.remove, { id });
    expect(await user.query(api.notes.list, {})).toEqual([]);
    const error = await user.mutation(api.notes.remove, { id }).catch((e) => e);
    expect(errors.is(error, "not_found")).toBe(true);
  });

  test("keeps each user's notes to themselves", async () => {
    const { signIn, user } = await setup();
    const other = await signIn();
    const id = await user.mutation(api.notes.create, { text: "mine" });

    expect(await other.query(api.notes.list, {})).toEqual([]);
    const error = await other.mutation(api.notes.remove, { id }).catch((e) => e);
    expect(errors.is(error, "not_found")).toBe(true);
    expect(await user.query(api.notes.list, {})).toHaveLength(1);
  });

  test("limits how fast one user can add notes", async () => {
    const { signIn, user } = await setup();
    // The bucket's capacity: 10 at once.
    for (let i = 0; i < 10; i++) await user.mutation(api.notes.create, { text: `note ${i}` });
    const error = await user.mutation(api.notes.create, { text: "one too many" }).catch((e) => e);
    expect(errors.is(error, "rate_limited")).toBe(true);

    // Each user has their own limit.
    const other = await signIn();
    await other.mutation(api.notes.create, { text: "mine" });
  });

  test("requires a session to write", async () => {
    const { t } = await setup();
    expect(await t.query(api.notes.list, {})).toEqual([]);
    const error = await t.mutation(api.notes.create, { text: "hi" }).catch((e) => e);
    expect(errors.is(error, "not_signed_in")).toBe(true);
  });
});
