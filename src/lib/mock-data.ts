// Demo seeds removed. Types are kept so existing imports keep compiling.
// Real lessons live in the `materials` table (Supabase). Real questions live
// in `exams` / `exam_questions` / `exam_options`.

import type { LanguageCode } from "./languages";

export type LessonCategory =
  | "traffic-laws"
  | "bus-systems"
  | "air-brakes"
  | "passenger-safety"
  | "road-signs"
  | "pre-trip"
  | "driving-safety"
  | "terminology"
  | "emergency";

export type Localized<T = string> = Partial<Record<LanguageCode, T>>;

export type Lesson = {
  id: string;
  title: Localized;
  voiceTracks?: Localized;
  subtitles?: Localized;
  category: LessonCategory;
  duration: number;
  progress: number;
  thumbnailHue: number;
};

export const lessons: Lesson[] = [];

export type QuizQuestion = {
  id: string;
  q: Localized;
  options: Localized[];
  correct: number;
  explain: Localized;
};

export const sampleQuestions: QuizQuestion[] = [];
