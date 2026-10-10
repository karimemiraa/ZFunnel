import "./globals.css";
import { AffiliateCapture } from "./affiliate-capture";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AffiliateCapture />
      </body>
    </html>
  );
}
