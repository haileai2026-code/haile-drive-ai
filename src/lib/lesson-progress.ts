// Local-first lesson progress tracker.
// Stores last position per lesson + the most recently watched lesson,
// so a student can resume even after closing the tab or if the camera failed.

const KEY_PROGRESS = "haile.lesson.progress.v1";
const KEY_LAST = "haile.lesson.last.v1";

export type LessonProgress = {
  lessonId: string;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
};

type ProgressMap = Record<string, LessonProgress>;

function readMap(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY_PROGRESS) || "{}");
  } catch {
    return {};
  }
}

function writeMap(map: ProgressMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_PROGRESS, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function getLessonProgress(lessonId: string): LessonProgress | null {
  return readMap()[lessonId] ?? null;
}

export function saveLessonProgress(p: LessonProgress) {
  const map = readMap();
  map[p.lessonId] = { ...p, updatedAt: Date.now() };
  writeMap(map);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY_LAST, p.lessonId);
    } catch {
      /* ignore */
    }
  }
}

export function getLastLessonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY_LAST);
  } catch {
    return null;
  }
}

export function getLastLessonProgress(): LessonProgress | null {
  const id = getLastLessonId();
  if (!id) return null;
  return getLessonProgress(id);
}

export function clearLessonProgress(lessonId: string) {
  const map = readMap();
  delete map[lessonId];
  writeMap(map);
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
