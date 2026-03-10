'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import Sidebar from '@/app/components/layouts/Sidebar';
import TrainerSidebar from '@/app/components/layouts/TrainerSidebar';
import ProfileCompletionCTA from '@/app/components/profile/ProfileCompletionCTA';
import MoodCheckIn from '@/app/components/profile/MoodCheckIn';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hydrate, hydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  const isTrainer = user?.role === 'trainer';
  const isOnTrainerRoute = pathname.startsWith('/trainer');

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    if (isTrainer && !isOnTrainerRoute) {
      router.replace('/trainer/dashboard');
    } else if (!isTrainer && isOnTrainerRoute) {
      router.replace('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, isTrainer, isOnTrainerRoute, router]);

  return (
    <div className="min-h-screen bg-kore-cream">
      {isTrainer ? <TrainerSidebar /> : <Sidebar />}
      <main className="xl:ml-64">
        {children}
      </main>
      {!isTrainer && <ProfileCompletionCTA />}
      {!isTrainer && <MoodCheckIn />}
    </div>
  );
}
