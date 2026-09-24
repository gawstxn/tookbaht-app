import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "@fontsource/ibm-plex-sans-thai/400.css";
import "@fontsource/ibm-plex-sans-thai/500.css";
import "@fontsource/ibm-plex-sans-thai/600.css";
import "@fontsource/ibm-plex-sans-thai/700.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/noto-serif-thai/600.css";
import "@fontsource/noto-serif-thai/700.css";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "ทุกบาท — บันทึกรายรับรายจ่าย",
  description: "บันทึกรายรับ รายจ่าย การโอน จัดการ subscriptions และตั้งเป้าหมายการเงิน",
  applicationName: "ทุกบาท",
  appleWebApp: { capable: true, title: "ทุกบาท", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // App-like: no pinch zoom, and iOS doesn't zoom into focused inputs.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f3f0e8",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render per request so Next.js can attach the CSP nonce from proxy.ts.
  await connection();
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
