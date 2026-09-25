import type { Metadata, Viewport } from "next";
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
import splashScreens from "@/lib/splash.json";

export const metadata: Metadata = {
  title: "Tookbaht",
  description: "บันทึกรายรับ รายจ่าย การโอน subscriptions และเป้าหมายการเงิน · Track income, expenses, subscriptions and money goals",
  applicationName: "Tookbaht",
  // startupImage: iOS launch screens (cream + logo) instead of a black screen while the app starts.
  appleWebApp: { capable: true, title: "Tookbaht", statusBarStyle: "default", startupImage: splashScreens },
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
