// Parse CSV / XLSX into rows, and serialize rows back out.
// Pure utility — no React, no DOM dependencies beyond File/Blob.

import * as XLSX from "xlsx";
import Papa from "papaparse";

export type RawRow = Record<string, string>;

export async function parseFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    const res = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
    const headers = res.meta.fields ?? [];
    return { headers, rows: (res.data ?? []).map(normalizeRow) };
  }
  // xlsx / xls
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: false });
  const headers = json.length ? Object.keys(json[0]) : [];
  return { headers, rows: json.map(normalizeRow) };
}

function normalizeRow(r: RawRow): RawRow {
  const out: RawRow = {};
  for (const k of Object.keys(r)) out[k] = String(r[k] ?? "").trim();
  return out;
}

// Auto-guess mapping of import headers -> our canonical fields.
export const STUDENT_FIELDS = [
  "name", "phone", "city", "branch", "language", "class", "status", "notes",
] as const;
export type StudentField = (typeof STUDENT_FIELDS)[number];

const ALIASES: Record<StudentField, string[]> = {
  name:    ["name", "full name", "fullname", "student", "שם", "ስም"],
  phone:   ["phone", "mobile", "tel", "טלפון", "ስልክ"],
  city:    ["city", "town", "עיר", "ከተማ"],
  branch:  ["branch", "location", "center", "סניף"],
  language:["language", "lang", "שפה", "ቋንቋ"],
  class:   ["class", "group", "כיתה"],
  status:  ["status", "state", "סטטוס"],
  notes:   ["notes", "note", "comment", "הערות"],
};

export function autoMap(headers: string[]): Record<StudentField, string | null> {
  const map = {} as Record<StudentField, string | null>;
  const lc = headers.map((h) => ({ orig: h, l: h.toLowerCase().trim() }));
  for (const f of STUDENT_FIELDS) {
    const found = lc.find((h) => ALIASES[f].some((a) => h.l === a || h.l.includes(a)));
    map[f] = found?.orig ?? null;
  }
  return map;
}

export type ValidatedRow = {
  index: number;
  raw: RawRow;
  values: Partial<Record<StudentField, string>>;
  errors: string[];
};

export function validate(
  rows: RawRow[],
  mapping: Record<StudentField, string | null>,
): ValidatedRow[] {
  return rows.map((raw, index) => {
    const values: Partial<Record<StudentField, string>> = {};
    for (const f of STUDENT_FIELDS) {
      const col = mapping[f];
      if (col) values[f] = (raw[col] ?? "").toString().trim();
    }
    const errors: string[] = [];
    if (!values.name) errors.push("Missing name");
    if (!values.phone) errors.push("Missing phone");
    else if (values.phone.replace(/\D/g, "").length < 7) errors.push("Phone too short");
    if (!values.city) errors.push("Missing city");
    return { index, raw, values, errors };
  });
}

// ---------- Export ----------
export function exportRows(
  rows: Record<string, unknown>[],
  filename: string,
  format: "csv" | "xlsx",
) {
  if (format === "csv") {
    const csv = Papa.unparse(rows);
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
