'use client';

import { useCallback, useState } from 'react';
import { SPLASH_SHOWN_KEY } from '@/lib/stores/authStore';

export function useSplashGate() {
  const [splashDone, setSplashDone] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(SPLASH_SHOWN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const handleSplashDone = useCallback(() => {
    setSplashDone(true);
    try {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
    } catch {
      // sessionStorage may be unavailable (private mode) — skip persistence.
    }
  }, []);

  return { splashDone, handleSplashDone };
}
