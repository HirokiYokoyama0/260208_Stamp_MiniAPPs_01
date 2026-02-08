import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "つくばホワイト歯科｜デジタル診察券",
  description: "ハブラーシカと一緒に、スマートな通院を。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-white antialiased font-sans">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
