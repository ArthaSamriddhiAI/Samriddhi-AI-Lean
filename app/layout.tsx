import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Source_Serif_4, Geist, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/chrome/TopBar";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-source-serif-4",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Samriddhi",
  description: "A wealth-advisory briefing tool. Prepared, not generated.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>
        <div className="flex h-screen flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
