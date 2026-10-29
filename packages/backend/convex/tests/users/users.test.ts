import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api } from "../../lib/api.refs";
import { errors } from "../../lib/errors";
import schema from "../../schema";
import { modules } from "../../test.setup";

/** A test backend and a signed-in user. Convex Auth's tokens carry the user id as `subject`. */
async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const user = t.withIdentity({ subject: userId });
  const read = () => t.run((ctx) => ctx.db.get("users", userId));
  return { t, user, read };
}

describe("users.setName", () => {
  test("sets the name, trimmed", async () => {
    const { user, read } = await setup();
    await user.mutation(api.users.setName, { name: "  Ada Lovelace " });
    expect((await read())?.name).toBe("Ada Lovelace");
  });

  test("removes the name when it's empty", async () => {
    const { user, read } = await setup();
    await user.mutation(api.users.setName, { name: "Ada" });
    await user.mutation(api.users.setName, { name: "   " });
    expect((await read())?.name).toBeUndefined();
  });

  test("rejects a name that's too long", async () => {
    const { user } = await setup();
    const error = await user.mutation(api.users.setName, { name: "x".repeat(61) }).catch((e) => e);
    expect(errors.is(error, "invalid_length")).toBe(true);
  });

  test("requires a session", async () => {
    const { t } = await setup();
    const error = await t.mutation(api.users.setName, { name: "Ada" }).catch((e) => e);
    expect(errors.is(error, "not_signed_in")).toBe(true);
  });
});
