import { ThemeProvider } from "@zfunnel/ui/theme";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ZFunnel", template: "%s · ZFunnel" },
  description: "Build funnels, sell products and grow your business.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
