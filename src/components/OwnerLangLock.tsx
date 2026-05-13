import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/**
 * Owner accounts must always operate in Hebrew. This component watches the
 * authenticated role and locks the i18n language to "he" while the owner is
 * signed in, releasing the lock for any other role.
 */
export function OwnerLangLock() {
  const { role } = useAuth();
  const { lockLanguage } = useI18n();

  useEffect(() => {
    if (role === "owner") {
      lockLanguage("he");
    } else {
      lockLanguage(null);
    }
  }, [role, lockLanguage]);

  return null;
}
