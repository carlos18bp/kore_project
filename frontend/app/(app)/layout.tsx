'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useSplashGate } from '@/lib/hooks/useSplashGate';
import Sidebar from '@/app/components/layouts/Sidebar';
import TrainerSidebar from '@/app/components/layouts/TrainerSidebar';
import MobileBottomNav from '@/app/components/layouts/MobileBottomNav';
import TrainerMobileBottomNav from '@/app/components/layouts/TrainerMobileBottomNav';
import AppSplash from '@/app/components/layouts/AppSplash';
import ProfileCompletionCTA from '@/app/components/profile/ProfileCompletionCTA';
import MoodCheckIn from '@/app/components/profile/MoodCheckIn';
import TrainerMessageModal from '@/app/components/dashboard/TrainerMessageModal';

const ALLOWED_WITHOUT_SUBSCRIPTION = ['/subscription', '/profile'];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hydrate, hydrated } = useAuthStore();
  const { hasActiveSubscription, subscriptions, loading: subsLoading, fetchSubscriptions } = useSubscriptionStore();
  const { splashDone, handleSplashDone } = useSplashGate();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  const isAdmin = user?.role === 'admin';
  const isTrainer = user?.role === 'trainer';
  const isOnTrainerRoute = pathname.startsWith('/trainer');

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    if (user.must_change_password && pathname !== '/change-password-required') {
      router.replace('/change-password-required');
      return;
    }
    if (isAdmin) {
      router.replace('/admin-platform/dashboard');
      return;
    }
    if (isTrainer && !isOnTrainerRoute) {
      router.replace('/trainer/dashboard');
    } else if (!isTrainer && isOnTrainerRoute) {
      router.replace('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, isAdmin, isTrainer, isOnTrainerRoute, pathname, router]);

  useEffect(() => {
    if (hydrated && isAuthenticated && user && !isTrainer && !isAdmin) {
      fetchSubscriptions();
    }
  }, [hydrated, isAuthenticated, user, isTrainer, isAdmin, fetchSubscriptions]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user || isTrainer || subsLoading) return;
    if (subscriptions.length === 0) return;
    if (hasActiveSubscription) return;

    const isAllowed = ALLOWED_WITHOUT_SUBSCRIPTION.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      router.replace('/subscription');
    }
  }, [hydrated, isAuthenticated, user, isTrainer, subsLoading, subscriptions, hasActiveSubscription, pathname, router]);

  const isChangePasswordRoute = pathname === '/change-password-required';
  const routeMatchesRole = isAdmin
    ? false
    : isTrainer
      ? isOnTrainerRoute
      : !isOnTrainerRoute;
  const mustRedirectForPassword =
    !!user?.must_change_password && !isChangePasswordRoute;

  const ready =
    splashDone &&
    hydrated &&
    isAuthenticated &&
    !!user &&
    !mustRedirectForPassword &&
    routeMatchesRole;

  if (!ready) {
    return <AppSplash onEntranceComplete={handleSplashDone} />;
  }

  return (
    <div className="min-h-screen bg-kore-cream">
      {isTrainer ? <TrainerSidebar /> : <Sidebar />}
      {isTrainer ? <TrainerMobileBottomNav /> : <MobileBottomNav />}
      <main className="xl:ml-64 pb-20 xl:pb-0">
        {children}
      </main>
      {!isTrainer && <ProfileCompletionCTA />}
      {!isTrainer && <MoodCheckIn />}
      {!isTrainer && !isAdmin && <TrainerMessageModal />}
    </div>
  );
}
