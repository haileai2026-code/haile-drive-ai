// Demo seeds removed. Types and pure helpers are kept so existing imports
// keep compiling. Real data lives in Supabase tables.

export type Role = "owner" | "staff" | "teacher" | "student";

export type City = { id: string; name: string };
export type Program = { id: string; name: string; cityIds: string[] };
export type Level = "beginner" | "intermediate" | "test-prep";

export type CandidateStatus =
  | "new-lead"
  | "contacted"
  | "missing-docs"
  | "waiting-opening"
  | "assigned"
  | "active"
  | "completed"
  | "failed"
  | "inactive";

export type Candidate = {
  id: string;
  name: string;
  phone: string;
  cityId: string;
  language: string;
  status: CandidateStatus;
  notes?: string;
  classId?: string;
  tags: string[];
  createdAt: string;
  timeline: { at: string; event: string }[];
};

export type ClassGroup = {
  id: string;
  name: string;
  cityId: string;
  programId: string;
  level: Level;
  teacherId: string;
  capacity: number;
  studentIds: string[];
  schedule: string;
  currentLessonId?: string;
};

export type AttendanceMark = "present" | "late" | "missing" | "makeup-completed";
export type AttendanceRecord = {
  id: string;
  classId: string;
  studentId: string;
  lessonId: string;
  date: string;
  mark: AttendanceMark;
};

export type MakeupTask = {
  id: string;
  studentId: string;
  missedLessonId: string;
  missedClassId: string;
  status: "pending" | "scheduled" | "completed";
  proposedClassId?: string;
};

export type Staff = {
  id: string;
  name: string;
  role: Role;
  cityIds: string[];
  permissions: string[];
};

export type AppNotification = {
  id: string;
  kind: "lesson" | "makeup" | "docs" | "attendance" | "announcement";
  title: string;
  body: string;
  at: string;
  read: boolean;
};

// ---------- Empty seeds ----------
export const cities: City[] = [];
export const programs: Program[] = [];
export const staff: Staff[] = [];
export const classes: ClassGroup[] = [];
export const candidates: Candidate[] = [];
export const attendanceToday: AttendanceRecord[] = [];
export const makeupQueue: MakeupTask[] = [];
export const notifications: AppNotification[] = [];

// ---------- Helpers ----------
export const studentName = (id: string) => `#${id}`;
export const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? id;
export const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? id;
export const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id;
export const teacherName = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

export const candidateStatusLabel: Record<CandidateStatus, string> = {
  "new-lead": "New Lead",
  contacted: "Contacted",
  "missing-docs": "Missing Docs",
  "waiting-opening": "Waiting for Opening",
  assigned: "Assigned",
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  inactive: "Inactive",
};

export const candidateStatusTone: Record<CandidateStatus, string> = {
  "new-lead": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  contacted: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  "missing-docs": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "waiting-opening": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  assigned: "bg-gold/15 text-gold border-gold/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-emerald-700/20 text-emerald-200 border-emerald-700/40",
  failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  inactive: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};
