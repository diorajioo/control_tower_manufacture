'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  identifyUser,
  startAnalytics,
  startScrollTracking,
  trackUserLoggedIn,
} from '@/lib/analytics/events';

function reportFromPath(): import('@/lib/analytics/events').Report | undefined {
  const p = window.location.pathname;
  if (p.startsWith('/dashboard/settings')) return 'settings';
  if (p.startsWith('/dashboard')) return 'dashboard_strategic'; // refined to tactical at toggle level
  if (p.startsWith('/lead-time')) return 'lead_time';
  if (p.startsWith('/monitor')) return 'monitor';
  return undefined;
}

export function AnalyticsBoot() {
  const { data: session, status } = useSession();
  const identified = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    const user = session.user;
    const id = (user as { id?: string }).id ?? user.email ?? '';
    const email = user.email ?? '';
    const name = user.name ?? '';

    startAnalytics({
      clientId: process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
      user: id ? { id, email, name } : null,
    });
    startScrollTracking(reportFromPath);

    if (!identified.current && id) {
      identified.current = true;
      identifyUser({ id, email, name });

      // Interactive login: set by login page before signIn() redirect
      if (sessionStorage.getItem('op_login')) {
        sessionStorage.removeItem('op_login');
        trackUserLoggedIn();
      }
    }
  }, [status, session?.user?.email]); // email as stable string key

  return null;
}
