import { dir } from "@zfunnel/i18n";
import { I18nProvider } from "@zfunnel/i18n/react";
import "./globals.css";
import { AffiliateCapture } from "./affiliate-capture";
import { ChatWidget } from "./chat-widget";
import { ClickCapture } from "./click-capture";
import { PoweredBy } from "./powered-by";
import { siteLocale } from "@/lib/i18n";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await siteLocale();
  return (
    <html lang={locale} dir={dir(locale)}>
      <body>
        <I18nProvider locale={locale}>
          {children}
          <AffiliateCapture />
          <ClickCapture />
          <ChatWidget />
          <PoweredBy />
        </I18nProvider>
      </body>
    </html>
  );
}
