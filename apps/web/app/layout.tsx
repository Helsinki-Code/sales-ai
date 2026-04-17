import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import type { Metadata } from "next";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Sales AI",
  description: "Production-grade AI sales workspace with BYOK Anthropic model execution"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${workSans.variable}`}>{children}</body>
    </html>
  );
}