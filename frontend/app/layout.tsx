import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "ThreatGuard" };
export const viewport: Viewport = { colorScheme: "light dark" };

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable + " " + geistMono.variable}>
      <body className="vbg-report vbg-custom-root">
        <link rel="stylesheet" href="https://vercel.com/geist/vercel-brand.css" precedence="vbg" referrerPolicy="no-referrer" />
        {children}
      </body>
    </html>
  );
}
