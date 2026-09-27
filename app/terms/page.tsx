import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_UPDATED } from "@/lib/legal";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata: Metadata = { title: "Terms of Use — Tookbaht" };

export default function TermsPage() {
  return (
    <LegalPage titleKey="login.terms" updated={TERMS_UPDATED}>
      <TermsContent />
    </LegalPage>
  );
}
