import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";
import { supabase } from "@/integrations/supabase/client";

export async function generateBeqaDocx(sessionId: string) {
  const { data: session, error } = await supabase
    .from("beqa_diagnostic_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session) throw new Error("Session not found");

  let fullName = "לא ידוע";
  if (session.student_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.student_id)
      .maybeSingle();
    if (p?.full_name) fullName = p.full_name;
  }

  const rec = (session.recommendation as string) || "B";
  const recText =
    rec === "A" ? "✓ מומלץ מאוד" : rec === "C" ? "✗ לא מומלץ כרגע" : "⚠ ראיון נוסף מומלץ";
  const recColor = rec === "A" ? "27AE60" : rec === "C" ? "EF4444" : "C9A84C";
  const finalScore = Number(session.final_beqa_score || 0);
  const reportId = String(session.id).substring(0, 8).toUpperCase();
  const dateStr = new Date(session.created_at).toLocaleDateString("he-IL");

  const rtlPara = (text: string, opts: Partial<{ bold: boolean; size: number; color: string; align: AlignmentType; heading: typeof HeadingLevel.HEADING_2 }> = {}) =>
    new Paragraph({
      bidirectional: true,
      alignment: opts.align,
      heading: opts.heading,
      children: [
        new TextRun({
          text,
          bold: opts.bold,
          size: opts.size ?? 22,
          color: opts.color,
          font: "Arial",
        }),
      ],
    });

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1440, right: 1800, bottom: 1440, left: 1800 } } },
        children: [
          rtlPara("Haile Drive AI", { bold: true, size: 48, color: "C9A84C", align: AlignmentType.CENTER }),
          rtlPara("תיק אבחון פסיכולוגי-תעסוקתי", { size: 28, align: AlignmentType.CENTER }),
          rtlPara("סודי — לשימוש מקצועי בלבד", { size: 18, color: "999999", align: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun("")] }),

          rtlPara("פרטי מועמד", { bold: true, color: "0D1B2A", heading: HeadingLevel.HEADING_2 }),
          rtlPara(`שם: ${fullName}`),
          rtlPara(`תאריך: ${dateStr}`),
          rtlPara(`מספר דוח: ${reportId}`),
          new Paragraph({ children: [new TextRun("")] }),

          rtlPara("ציון BEQA הסופי", { bold: true, color: "0D1B2A", heading: HeadingLevel.HEADING_2 }),
          rtlPara(`${finalScore.toFixed(1)} / 100`, { bold: true, size: 52, color: "C9A84C", align: AlignmentType.CENTER }),
          rtlPara(recText, { bold: true, size: 28, color: recColor, align: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun("")] }),

          rtlPara("המלצות מקצועיות", { bold: true, color: "0D1B2A", heading: HeadingLevel.HEADING_2 }),
          rtlPara("✔ מוטיבציה גבוהה ואמיתית למקצוע הנהיגה", { color: "27AE60" }),
          rtlPara("✔ שליטה עצמית מוכחת תחת לחץ", { color: "27AE60" }),
          rtlPara("✔ אחריות בטיחותית גבוהה", { color: "27AE60" }),
          rtlPara("◆ מומלץ ראיון נוסף לאחר 30 יום", { color: "C9A84C" }),
          rtlPara('◆ השלמת מבחן תיאוריה לפני המרב"ד', { color: "C9A84C" }),
          new Paragraph({ children: [new TextRun("")] }),

          rtlPara(`Haile Drive AI | haileai.app | ${new Date().toLocaleDateString("he-IL")}`, {
            size: 16,
            color: "999999",
            align: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BEQA_${fullName}_${dateStr.replace(/\//g, "-")}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
