import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata: Metadata = { title: "Terms of Use — Tookbaht" };

export default function TermsPage() {
  return (
    <LegalPage titleKey="login.terms" updated="2026-09-25">
      <TermsContent />
    </LegalPage>
  );
}
