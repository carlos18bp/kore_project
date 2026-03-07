'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import Sidebar from '@/app/components/layouts/Sidebar';
import ProfileCompletionCTA from '@/app/components/profile/ProfileCompletionCTA';
import MoodCheckIn from '@/app/components/profile/MoodCheckIn';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { isAuthenticated, hydrate, hydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-kore-cream">
      <Sidebar />
      <main className="xl:ml-64">
        {children}
      </main>
      <ProfileCompletionCTA />
      <MoodCheckIn />
    </div>
  );
}
