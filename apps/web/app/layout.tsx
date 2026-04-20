import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Sales AI",
    template: "%s | Sales AI",
  },
  description:
    "Developer-first sales AI platform with 15 production endpoints, BYOK security, and async job infrastructure.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
