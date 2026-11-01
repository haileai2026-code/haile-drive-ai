import { describe, expect, test } from "bun:test";
import { likeLiteral } from "../src/lib/sql-like";

describe("likeLiteral", () => {
  test("plain email unchanged", () => {
    expect(likeLiteral("a.b@test.invalid")).toBe("a.b@test.invalid");
  });
  test("escapes wildcards and backslash", () => {
    expect(likeLiteral("a_b%c\\d@test.invalid")).toBe("a\\_b\\%c\\\\d@test.invalid");
  });
});
