import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PrelineScript } from "@/components/shared/PrelineScript";

// Wise design language: Inter for body/utility, Manrope (geometric, heavy)
// as the display face standing in for proprietary Wise Sans.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="font-sans">
        {children}
        <Toaster />
        <PrelineScript />
      </body>
    </html>
  );
}
