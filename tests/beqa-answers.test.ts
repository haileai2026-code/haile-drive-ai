// Run: bun test tests/beqa-answers.test.ts
import { describe, expect, test } from "bun:test";
import { assertExactQuestionSet } from "../src/lib/diagnostics/answer-set";
import { assertPsychAssessmentsEnabled, isPsychAssessmentRoute } from "../src/lib/psych-assessments-flag";
import { gradePsych } from "../src/lib/diagnostics/psych-grading";
import { PSYCH_QUESTIONS, PSYCH_QUESTION_IDS } from "../src/lib/diagnostics/psych-questions";
import { DIAG_QUESTIONS, DIAG_QUESTION_IDS } from "../src/lib/diagnostics/questions";
import { OPTION_SCORES } from "../src/lib/diagnostics/scoring";

describe("assertExactQuestionSet (anti-forgery)", () => {
  const ids = DIAG_QUESTION_IDS;
  test("exact set passes", () => {
    expect(() => assertExactQuestionSet([...ids].reverse(), ids)).not.toThrow();
  });
  test("duplicate rejected", () => {
    expect(() => assertExactQuestionSet([...ids.slice(0, -1), ids[0]], ids)).toThrow(/duplicate/);
  });
  test("unknown id rejected", () => {
    expect(() => assertExactQuestionSet([...ids.slice(0, -1), "qe1"], ids)).toThrow(/unknown/);
  });
  test("missing id rejected", () => {
    expect(() => assertExactQuestionSet(ids.slice(1), ids)).toThrow(/incomplete/);
  });
  test("extra answer rejected", () => {
    expect(() => assertExactQuestionSet([...ids, "q11"], ids)).toThrow();
  });
});

describe("single bank (CTO gate 5)", () => {
  test("both flows use q1-q10 + qp only", () => {
    const want = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "qp"];
    expect(PSYCH_QUESTION_IDS).toEqual(want);
    expect(DIAG_QUESTION_IDS).toEqual(want);
    expect(Object.keys(OPTION_SCORES).sort()).toEqual([...want].sort());
  });
  test("client question modules carry no scores", () => {
    for (const q of [...PSYCH_QUESTIONS, ...DIAG_QUESTIONS]) {
      for (const o of q.options) expect("score" in o).toBe(false);
      expect(OPTION_SCORES[q.id].length).toBe(q.options.length);
    }
  });
});

describe("gradePsych (server)", () => {
  const all = (idx: number) => Object.fromEntries(PSYCH_QUESTION_IDS.map((id) => [id, idx]));
  test("grades a full set", () => {
    const g = gradePsych(all(0));
    expect(g.score).toBeGreaterThan(0);
    expect(["A", "B", "C"]).toContain(g.rec.letter);
  });
  test("best answers give A", () => {
    const best = Object.fromEntries(PSYCH_QUESTION_IDS.map((id) => [id, OPTION_SCORES[id].indexOf(Math.max(...OPTION_SCORES[id]))]));
    expect(gradePsych(best).rec.letter).toBe("A");
  });
  test("rejects unknown, out of range, incomplete", () => {
    expect(() => gradePsych({ ...all(0), qe1: 0 })).toThrow(/unknown/);
    expect(() => gradePsych({ ...all(0), q1: 9 })).toThrow(/invalid option/);
    const { q1: _drop, ...rest } = all(0);
    expect(() => gradePsych(rest)).toThrow(/incomplete/);
  });
});

describe("psych assessments beta flag", () => {
  test("server guard throws while the flag is off (default)", () => {
    expect(() => assertPsychAssessmentsEnabled()).toThrow();
    expect(() => assertPsychAssessmentsEnabled({ heartRate: true })).toThrow();
  });
  test("route matcher", () => {
    expect(isPsychAssessmentRoute("/psych-diagnostic")).toBe(true);
    expect(isPsychAssessmentRoute("/marvad-simulator/x")).toBe(true);
    expect(isPsychAssessmentRoute("/dashboard")).toBe(false);
  });
});
