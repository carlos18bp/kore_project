'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import AppSplash from '@/app/components/layouts/AppSplash';
import { useSplashGate } from '@/lib/hooks/useSplashGate';
import { useMounted } from '@/lib/hooks/useMounted';
import AdminMobileBottomNav from '@/app/components/layouts/AdminMobileBottomNav';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const { splashDone, handleSplashDone } = useSplashGate();
  const mounted = useMounted();

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
    !mounted ||
    !splashDone ||
    !hydrated ||
    !isAuthenticated ||
    !user ||
    user.role !== 'admin' ||
    user.must_change_password
  ) {
    return <AppSplash onEntranceComplete={handleSplashDone} />;
  }

  return (
    <>
      {children}
      <AdminMobileBottomNav />
    </>
  );
}
