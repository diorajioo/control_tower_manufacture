import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Control Tower Manufacture",
  description: "Manufacturing KPI Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sidebar hidden/shown is applied before the first paint (CSS in globals.css), so a reload never flashes the menu */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ct-sidebar-collapsed")==="1")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
