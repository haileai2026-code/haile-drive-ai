import { Link } from "@tanstack/react-router";
import { Lock, Phone, Mail } from "lucide-react";

export function LeadLockScreen() {
  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/10 to-card/40 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-gold/15 text-gold">
          <Lock className="h-10 w-10" />
        </div>

        <h1 className="text-2xl font-bold">ברוך הבא ל־Haile Drive AI</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          ההרשמה שלך נקלטה בהצלחה.
          <br />
          כדי להתחיל ללמוד — יש להסדיר את תשלום שכר הלימוד.
          <br />
          לאחר אישור התשלום, תיפתח הגישה לשיעורים, מבחנים, קהילה וסוכן ה־AI שלך.
        </p>

        <div className="mt-6 rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
          <div className="font-semibold text-foreground" lang="am">እንኳን ደህና መጡ!</div>
          <div lang="am" className="mt-1 leading-relaxed">
            ምዝገባዎ ተቀብሏል። ትምህርት ለመጀመር፣ እባክዎ የትምህርት ክፍያውን ያጠናቅቁ።
            <br />
            ክፍያው ከተረጋገጠ በኋላ የትምህርት ይዘቶቹ ይከፈቱልዎታል።
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <div className="font-semibold">לפניה למשרד:</div>
          <a href="tel:+972500000000" className="inline-flex items-center gap-2 text-gold hover:underline">
            <Phone className="h-4 w-4" /> 050-000-0000
          </a>
          <a href="mailto:office@haileai.app" className="inline-flex items-center gap-2 text-gold hover:underline">
            <Mail className="h-4 w-4" /> office@haileai.app
          </a>
        </div>

        <div className="mt-6">
          <Link to="/profile" className="text-xs text-muted-foreground underline">פרופיל ויציאה</Link>
        </div>
      </div>
    </div>
  );
}
