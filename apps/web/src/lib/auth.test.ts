import { describe, expect, test } from "vite-plus/test";
import { validateNext } from "./auth";

describe("validateNext", () => {
  test("keeps a path on this site", () => {
    expect(validateNext({ next: "/notes?x=1" })).toEqual({ next: "/notes?x=1" });
  });

  test("drops anything that could leave the site", () => {
    for (const next of ["//evil.example", "/\\evil.example", "https://evil.example", "notes", 1]) {
      expect(validateNext({ next })).toEqual({});
    }
  });
});
