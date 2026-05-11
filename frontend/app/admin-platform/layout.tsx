'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { user, isAuthenticated, hydrate, hydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
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
    !hydrated ||
    !isAuthenticated ||
    !user ||
    user.role !== 'admin' ||
    user.must_change_password
  ) {
    return null;
  }

  return <>{children}</>;
}
