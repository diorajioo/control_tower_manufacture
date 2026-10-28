import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Control Tower Manufacture",
  description: "Manufacturing KPI Dashboard",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by middleware.ts with the CSP; reading it also makes every page render per request,
  // which the nonce needs (Next.js stamps it on its own scripts only when rendering dynamically).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sidebar hidden/shown is applied before the first paint (CSS in globals.css), so a reload never flashes the menu.
            Static string, no user input — the nonce lets it past the CSP. */}
        <script
          nonce={nonce}
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
