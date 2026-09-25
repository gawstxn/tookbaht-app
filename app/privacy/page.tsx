import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_VERSION } from "@/lib/legal";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata: Metadata = { title: "Privacy Policy — Tookbaht" };

export default function PrivacyPage() {
  return (
    <LegalPage titleKey="login.privacy" updated={TERMS_VERSION}>
      <PrivacyContent />
    </LegalPage>
  );
}
