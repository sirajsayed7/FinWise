import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinWise",
  description: "Upload bank statements, categorize transactions, and understand spending with a private mobile finance dashboard.",
  applicationName: "FinWise",
  appleWebApp: {
    capable: true,
    title: "FinWise",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: "#0D0F1C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" style={{ background: "#0D0F1C" }}>
      <body suppressHydrationWarning style={{ background: "#0D0F1C" }}>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
