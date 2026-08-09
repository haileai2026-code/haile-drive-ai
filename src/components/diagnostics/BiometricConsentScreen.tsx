import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

/**
 * Version identifier of the consent wording. Bump when the text changes so
 * stored consents remain auditable.
 */
export const CONSENT_TEXT_VERSION = "beqa-biometric-v1";

/**
 * TODO (school/admin): confirm the actual retention policy for biometric
 * diagnostic data (heart-rate samples, facial-expression metrics) and replace
 * the generic wording in the `consentRetention` locale strings with the
 * agreed, concrete retention period.
 */

/** Records a consent decision. Returns true when a granted record was stored. */
export async function recordBiometricConsent(studentId: string, granted: boolean) {
  const { error } = await supabase.from("biometric_consents").insert({
    student_id: studentId,
    granted,
    consent_text_version: CONSENT_TEXT_VERSION,
  });
  if (error) throw error;
  return granted;
}

/** Server-of-record check: is there a granted consent for this student? */
export async function hasGrantedBiometricConsent(studentId: string) {
  const { data, error } = await supabase
    .from("biometric_consents")
    .select("id")
    .eq("student_id", studentId)
    .eq("granted", true)
    .eq("consent_text_version", CONSENT_TEXT_VERSION)
    .order("consented_at", { ascending: false })
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

type Props = {
  studentId: string;
  onGranted: () => void;
};

export function BiometricConsentScreen({ studentId, onGranted }: Props) {
  const { t, dir } = useI18n();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  const submit = async (granted: boolean) => {
    setBusy(true);
    try {
      await recordBiometricConsent(studentId, granted);
      if (granted) onGranted();
      else setDeclined(true);
    } catch (e: any) {
      toast.error(e?.message ?? "שמירת ההסכמה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  if (declined) {
    return (
      <div dir={dir} className="mx-auto max-w-md py-12 text-center space-y-5">
        <div className="text-5xl">🙏</div>
        <h1 className="text-xl font-bold">{t("consentDeclinedTitle")}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{t("consentDeclinedMsg")}</p>
        <Link to="/dashboard">
          <Button className="w-full">{t("consentBackHome")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div dir={dir} className="mx-auto max-w-xl py-8">
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-1 text-center">
            <div className="text-4xl">🎥</div>
            <h1 className="text-2xl font-bold">{t("consentTitle")}</h1>
          </div>

          <div className="space-y-3 text-sm leading-relaxed">
            <p>{t("consentIntro")}</p>
            <p>
              <span className="font-semibold">{t("consentWhyLabel")}: </span>
              {t("consentWhy")}
            </p>
            <p>
              <span className="font-semibold">{t("consentRetentionLabel")}: </span>
              {t("consentRetention")}
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm font-medium">{t("consentCheckbox")}</span>
          </label>

          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={!checked || busy} onClick={() => submit(true)}>
              {t("consentContinue")}
            </Button>
            <Button size="lg" variant="ghost" disabled={busy} onClick={() => submit(false)}>
              {t("consentDecline")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
