// Operational mock data for the training management system.
// Drop-in replacement once Lovable Cloud is enabled — schemas mirror DB tables.

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
  schedule: string; // human-readable for now
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

// ---------- Seeds ----------
export const cities: City[] = [
  { id: "c-pt", name: "Petah Tikva" },
  { id: "c-as", name: "Ashdod" },
  { id: "c-hf", name: "Haifa" },
];

export const programs: Program[] = [
  { id: "p-bus", name: "Bus License", cityIds: ["c-pt", "c-as", "c-hf"] },
  { id: "p-truck", name: "Heavy Truck", cityIds: ["c-pt", "c-hf"] },
  { id: "p-theory", name: "Theory Preparation", cityIds: ["c-pt", "c-as", "c-hf"] },
];

export const staff: Staff[] = [
  { id: "u-owner", name: "Haile (Owner)", role: "owner", cityIds: cities.map((c) => c.id), permissions: ["*"] },
  { id: "u-staff-1", name: "Mekdes", role: "staff", cityIds: ["c-pt"], permissions: ["candidates", "attendance"] },
  { id: "u-tch-1", name: "Yossi Levi", role: "teacher", cityIds: ["c-pt"], permissions: ["attendance"] },
  { id: "u-tch-2", name: "Rahel Tadesse", role: "teacher", cityIds: ["c-as"], permissions: ["attendance"] },
];

const studentIds = Array.from({ length: 24 }, (_, i) => `s-${i + 1}`);

export const classes: ClassGroup[] = [
  {
    id: "cl-pt-bus-1",
    name: "PT · Bus · Group A",
    cityId: "c-pt",
    programId: "p-bus",
    level: "beginner",
    teacherId: "u-tch-1",
    capacity: 16,
    studentIds: studentIds.slice(0, 12),
    schedule: "Sun/Tue/Thu · 18:00–20:30",
    currentLessonId: "air-brakes-1",
  },
  {
    id: "cl-as-truck-1",
    name: "AS · Truck · Group B",
    cityId: "c-as",
    programId: "p-truck",
    level: "intermediate",
    teacherId: "u-tch-2",
    capacity: 14,
    studentIds: studentIds.slice(12, 22),
    schedule: "Mon/Wed · 17:00–20:00",
    currentLessonId: "pre-trip-1",
  },
  {
    id: "cl-pt-theory-1",
    name: "PT · Theory · Test Prep",
    cityId: "c-pt",
    programId: "p-theory",
    level: "test-prep",
    teacherId: "u-tch-1",
    capacity: 20,
    studentIds: studentIds.slice(0, 8),
    schedule: "Sat · 09:00–13:00",
    currentLessonId: "signs-1",
  },
];

export const candidates: Candidate[] = [
  {
    id: "cd-1", name: "Tesfaye Bekele", phone: "+972 50 111 2233", cityId: "c-pt", language: "Amharic",
    status: "new-lead", tags: ["bus"], createdAt: "2025-05-01",
    timeline: [{ at: "2025-05-01", event: "Lead created from website" }],
  },
  {
    id: "cd-2", name: "Mulu Abebe", phone: "+972 52 333 4455", cityId: "c-as", language: "Amharic",
    status: "contacted", tags: ["truck"], createdAt: "2025-04-28", notes: "Wants evening class",
    timeline: [{ at: "2025-04-28", event: "Lead created" }, { at: "2025-04-30", event: "Called — interested" }],
  },
  {
    id: "cd-3", name: "Avi Cohen", phone: "+972 54 777 8899", cityId: "c-pt", language: "Hebrew",
    status: "missing-docs", tags: ["theory"], createdAt: "2025-04-20",
    timeline: [{ at: "2025-04-20", event: "Lead created" }, { at: "2025-04-22", event: "Requested ID copy" }],
  },
  {
    id: "cd-4", name: "Genet Solomon", phone: "+972 53 222 3344", cityId: "c-pt", language: "Amharic",
    status: "waiting-opening", tags: ["bus"], createdAt: "2025-04-15",
    timeline: [{ at: "2025-04-15", event: "Lead created" }, { at: "2025-04-25", event: "Docs verified" }],
  },
  {
    id: "cd-5", name: "Yitzhak Levi", phone: "+972 50 444 5566", cityId: "c-as", language: "Hebrew",
    status: "assigned", classId: "cl-as-truck-1", tags: ["truck"], createdAt: "2025-04-10",
    timeline: [{ at: "2025-04-12", event: "Assigned to AS · Truck · Group B" }],
  },
  {
    id: "cd-6", name: "Dawit Hailu", phone: "+972 58 999 1122", cityId: "c-pt", language: "Amharic",
    status: "active", classId: "cl-pt-bus-1", tags: ["bus"], createdAt: "2025-03-20",
    timeline: [{ at: "2025-03-25", event: "Started Group A" }],
  },
];

export const attendanceToday: AttendanceRecord[] = [
  { id: "a1", classId: "cl-pt-bus-1", studentId: "s-1", lessonId: "air-brakes-1", date: "today", mark: "present" },
  { id: "a2", classId: "cl-pt-bus-1", studentId: "s-2", lessonId: "air-brakes-1", date: "today", mark: "late" },
  { id: "a3", classId: "cl-pt-bus-1", studentId: "s-3", lessonId: "air-brakes-1", date: "today", mark: "missing" },
  { id: "a4", classId: "cl-pt-bus-1", studentId: "s-4", lessonId: "air-brakes-1", date: "today", mark: "present" },
  { id: "a5", classId: "cl-as-truck-1", studentId: "s-13", lessonId: "pre-trip-1", date: "today", mark: "missing" },
];

export const makeupQueue: MakeupTask[] = [
  { id: "m1", studentId: "s-3", missedLessonId: "air-brakes-1", missedClassId: "cl-pt-bus-1", status: "pending" },
  { id: "m2", studentId: "s-13", missedLessonId: "pre-trip-1", missedClassId: "cl-as-truck-1", status: "scheduled", proposedClassId: "cl-pt-bus-1" },
  { id: "m3", studentId: "s-7", missedLessonId: "signs-1", missedClassId: "cl-pt-theory-1", status: "completed" },
];

export const notifications: AppNotification[] = [
  { id: "n1", kind: "attendance", title: "3 students missing today", body: "PT · Bus · Group A — review and trigger makeup.", at: "10m ago", read: false },
  { id: "n2", kind: "docs", title: "Missing documents", body: "Avi Cohen — ID copy not received.", at: "2h ago", read: false },
  { id: "n3", kind: "makeup", title: "Makeup scheduled", body: "Yitzhak Levi moved to PT · Bus · Group A on Thu.", at: "Yesterday", read: true },
  { id: "n4", kind: "announcement", title: "New theory videos uploaded", body: "5 new Amharic-narrated lessons in Road Signs.", at: "2d ago", read: true },
];

// ---------- Helpers ----------
export const studentName = (id: string) => {
  const cd = candidates.find((c) => c.classId && classes.find((cl) => cl.id === cd?.classId));
  return cd?.name ?? `Student #${id.replace("s-", "")}`;
};
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
