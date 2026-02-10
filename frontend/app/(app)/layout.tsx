'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import Sidebar from '@/app/components/layouts/Sidebar';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { isAuthenticated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const { isAuthenticated: stillAuth } = useAuthStore.getState();
      if (!stillAuth) router.push('/login');
    }, 150);
    return () => clearTimeout(timeout);
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-kore-cream">
      <Sidebar />
      <main className="ml-64">
        {children}
      </main>
    </div>
  );
}
