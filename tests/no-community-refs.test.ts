// Run: bun test tests/no-community-refs.test.ts
// CTO decision 2026-11-01: no community / origin wording in prompts and reports.
// Language names (Amharic / Russian / Hebrew as languages) are allowed.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const FILES = [
  "src/lib/ai-chat.functions.ts",
  "src/lib/ai-agent.functions.ts",
  "src/lib/beqa-report.functions.ts",
  "src/lib/diagnostics/pdf-report.ts",
  "src/routes/admin.diagnostics.tsx",
];
const ORIGIN = [/Ethiopian/i, /Manasseh/i, /communities/i, /אתיופ/, /קוקי/, /מנשה/, /קהילה ושפה/, /קהילתי/, /קהילה:/, /"קהילה"/, /community_type/];

describe("no community / origin references", () => {
  test.each(FILES)("%s", (f) => {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const re of ORIGIN) expect(src).not.toMatch(re);
  });
  test("language rules stay in the tutor prompt", () => {
    const src = readFileSync(new URL("../src/lib/ai-chat.functions.ts", import.meta.url), "utf8");
    expect(src).toContain("Amharic");
    expect(src).toContain("Russian");
  });
});
