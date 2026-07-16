import type { Metadata, Viewport } from "next";
import AlarmModeOverlay from "@/components/AlarmModeOverlay";
import CloudDataSyncBridge from "@/components/CloudDataSyncBridge";
import PurchaseMailAutoSyncBridge from "@/components/PurchaseMailAutoSyncBridge";
import SmartReminderAgent from "@/components/SmartReminderAgent";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "나의 비서",
    template: "%s | 나의 비서",
  },
  description: "말하거나 입력한 생각을 AI가 정리하고 일정과 기록으로 관리하는 개인 비서 앱",
  applicationName: "나의 비서",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "나의 비서",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#3182F6",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <CloudDataSyncBridge />
        <PurchaseMailAutoSyncBridge />
        <SmartReminderAgent />
        <AlarmModeOverlay />
      </body>
    </html>
  );
}
