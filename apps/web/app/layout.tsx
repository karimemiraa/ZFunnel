import { dir } from "@zfunnel/i18n";
import { I18nProvider } from "@zfunnel/i18n/react";
import { ThemeProvider } from "@zfunnel/ui/theme";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const ar = (await getLocale()) === "ar";
  return {
    title: { default: "ZFunnel", template: "%s · ZFunnel" },
    description: ar
      ? "ابنِ قمع مبيعاتك، وبِع منتجاتك، ونمِّ أعمالك من مكان واحد."
      : "Build funnels, sell products and grow your business.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dir(locale)} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <I18nProvider locale={locale}>
          <ThemeProvider>{children}</ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
