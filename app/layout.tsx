import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinWise",
  description: "Upload bank statements, categorize transactions, and understand spending with a private mobile finance dashboard.",
  applicationName: "FinWise",
  appleWebApp: {
    capable: true,
    title: "FinWise",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#633EF2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
