'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import AppSplash from '@/app/components/layouts/AppSplash';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [splashDone, setSplashDone] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('kore_splash_shown') === '1';
    } catch {
      return false;
    }
  });
  const handleSplashDone = useCallback(() => {
    setSplashDone(true);
    try {
      sessionStorage.setItem('kore_splash_shown', '1');
    } catch {
      // sessionStorage may be unavailable — skip persistence silently.
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!user) return;
    if (user.must_change_password) {
      router.replace('/change-password-required');
      return;
    }
    if (user.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (
    !splashDone ||
    !hydrated ||
    !isAuthenticated ||
    !user ||
    user.role !== 'admin' ||
    user.must_change_password
  ) {
    return <AppSplash onEntranceComplete={handleSplashDone} />;
  }

  return <>{children}</>;
}
