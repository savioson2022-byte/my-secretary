import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나의 비서 MVP",
  description: "개인 AI 비서 웹앱 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
