import "./globals.css";
import { AffiliateCapture } from "./affiliate-capture";
import { ChatWidget } from "./chat-widget";
import { ClickCapture } from "./click-capture";
import { PoweredBy } from "./powered-by";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AffiliateCapture />
        <ClickCapture />
        <ChatWidget />
        <PoweredBy />
      </body>
    </html>
  );
}
