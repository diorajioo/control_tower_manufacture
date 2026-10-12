"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n";
import { AnalyticsBoot } from "@/components/analytics/AnalyticsBoot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <AnalyticsBoot />
        {children}
      </I18nProvider>
    </SessionProvider>
  );
}
