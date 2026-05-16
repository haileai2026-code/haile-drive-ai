// Parse CSV / XLSX into rows, and serialize rows back out.
// Uses exceljs (xlsx replaced for security).

import ExcelJS from "exceljs";
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
  // xlsx / xls via exceljs
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const headers: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });
  for (let i = 0; i < headers.length; i++) if (!headers[i]) headers[i] = `col_${i + 1}`;

  const rows: RawRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const r: RawRow = {};
    headers.forEach((h, idx) => {
      const v = row.getCell(idx + 1).value;
      r[h] = cellToString(v);
    });
    // skip rows where everything is empty
    if (Object.values(r).some((v) => v !== "")) rows.push(normalizeRow(r));
  });
  return { headers, rows };
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Rich text / hyperlink / formula objects
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text.trim();
    if (typeof obj.result !== "undefined") return String(obj.result).trim();
    if (Array.isArray((obj as { richText?: unknown[] }).richText)) {
      return ((obj as { richText: { text: string }[] }).richText).map((r) => r.text).join("").trim();
    }
  }
  return String(v).trim();
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
export async function exportRows(
  rows: Record<string, unknown>[],
  filename: string,
  format: "csv" | "xlsx",
): Promise<void> {
  if (format === "csv") {
    const csv = Papa.unparse(rows);
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    return;
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Export");
  const headers = rows.length ? Object.keys(rows[0]) : [];
  if (headers.length) {
    ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(12, h.length + 2) }));
    rows.forEach((r) => ws.addRow(r));
  }
  const out = await wb.xlsx.writeBuffer();
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
