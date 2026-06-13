import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PrelineScript } from "@/components/shared/PrelineScript";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NexaBrew — Cafe POS & Management System",
  description: "Real-time cafe POS, kitchen display, and management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
        <PrelineScript />
      </body>
    </html>
  );
}
