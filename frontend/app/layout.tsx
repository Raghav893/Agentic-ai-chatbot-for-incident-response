import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { themeStorageKey } from "../lib/theme";
import "./globals.css";

export const metadata: Metadata = { title: "Antinious" };
export const viewport: Viewport = { colorScheme: "light dark" };

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const restoreTheme = `try {
  const theme = localStorage.getItem(${JSON.stringify(themeStorageKey)});
  if (theme === "light" || theme === "dark") document.documentElement.classList.add(theme);
} catch {}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable + " " + geistMono.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: restoreTheme }} /></head>
      <body className="vbg-report vbg-custom-root">
        <link rel="stylesheet" href="https://vercel.com/geist/vercel-brand.css" precedence="vbg" referrerPolicy="no-referrer" />
        {children}
      </body>
    </html>
  );
}
