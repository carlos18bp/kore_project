'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { WHATSAPP_URL } from '@/lib/constants';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';

/**
 * Bottom sheet items for the "Evaluaciones" tab.
 */
const evaluationItems = [
  {
    label: 'Mi Diagnóstico',
    href: '/my-diagnosis',
    pendingKey: 'anthropometry' as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    label: 'Evaluación Postural',
    href: '/my-posturometry',
    pendingKey: 'posturometry' as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    label: 'Evaluación Física',
    href: '/my-physical-evaluation',
    pendingKey: 'physical_eval' as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

/**
 * Bottom sheet items for the "Más" tab.
 */
const moreNavItems = [
  {
    label: 'Mi Programa',
    href: '/mi-programa',
    pendingKey: 'program' as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
  },
  {
    label: 'Mi Nutrición',
    href: '/my-nutrition',
    pendingKey: 'nutrition' as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c.847 0 1.531.684 1.531 1.531v1.531a1.531 1.531 0 01-1.531 1.531 1.531 1.531 0 01-1.531-1.531V3.781c0-.847.684-1.531 1.531-1.531zm-4.5 4.5c.847 0 1.531.684 1.531 1.531v1.531a1.531 1.531 0 01-1.531 1.531 1.531 1.531 0 01-1.531-1.531V8.281c0-.847.684-1.531 1.531-1.531zm9 0c.847 0 1.531.684 1.531 1.531v1.531a1.531 1.531 0 01-1.531 1.531 1.531 1.531 0 01-1.531-1.531V8.281c0-.847.684-1.531 1.531-1.531zM12 9.75c.847 0 1.531.684 1.531 1.531v1.531a1.531 1.531 0 01-1.531 1.531 1.531 1.531 0 01-1.531-1.531v-1.531c0-.847.684-1.531 1.531-1.531z" />
      </svg>
    ),
  },
  {
    label: 'PAR-Q',
    href: '/my-parq',
    pendingKey: 'parq' as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
      </svg>
    ),
  },
  {
    label: 'Mi Suscripción',
    href: '/subscription',
    pendingKey: 'subscription' as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
];

type SheetType = 'evaluaciones' | 'mas' | null;

const ALLOWED_WITHOUT_SUBSCRIPTION = ['/subscription', '/profile'];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { hasActiveSubscription, subscriptions } = useSubscriptionStore();
  const {
    nutritionDue, parqDue,
    anthropometryUnseen, posturometryUnseen, physicalEvalUnseen,
    subscriptionExpiring, markSeen,
  } = usePendingAssessmentsStore();
  const subscriptionExpired = subscriptions.length > 0 && !hasActiveSubscription;

  const [openSheet, setOpenSheet] = useState<SheetType>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close sheet on route change
  useEffect(() => {
    setOpenSheet(null);
  }, [pathname]);

  // Close sheet on click outside
  useEffect(() => {
    if (!openSheet) return;
    const handleClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpenSheet(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openSheet]);

  const hasEvalBadge = anthropometryUnseen || posturometryUnseen || physicalEvalUnseen;
  const hasMoreBadge = nutritionDue || parqDue || subscriptionExpiring;

  const pendingMap: Record<string, boolean> = {
    anthropometry: anthropometryUnseen,
    posturometry: posturometryUnseen,
    physical_eval: physicalEvalUnseen,
    nutrition: nutritionDue,
    parq: parqDue,
    subscription: subscriptionExpiring,
  };

  const markSeenMap: Record<string, string> = {
    '/my-diagnosis': 'anthropometry',
    '/my-posturometry': 'posturometry',
    '/my-physical-evaluation': 'physical_eval',
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const isEvalActive = ['/my-diagnosis', '/my-posturometry', '/my-physical-evaluation'].some(
    (p) => pathname === p || pathname.startsWith(p)
  );
  const isMoreActive = ['/my-nutrition', '/my-parq', '/subscription'].some(
    (p) => pathname === p || pathname.startsWith(p)
  );

  const handleSheetNavigation = (href: string) => {
    const seenKey = markSeenMap[href];
    if (seenKey) markSeen(seenKey);
    setOpenSheet(null);
    router.push(href);
  };

  const isItemAllowed = (href: string) =>
    !subscriptionExpired || ALLOWED_WITHOUT_SUBSCRIPTION.some((p) => href.startsWith(p));

  return (
    <>
      {/* Backdrop */}
      {openSheet && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 xl:hidden"
          onClick={() => setOpenSheet(null)}
        />
      )}

      {/* Bottom Sheet */}
      {openSheet && (
        <div
          ref={sheetRef}
          className="fixed bottom-16 left-0 right-0 z-50 xl:hidden px-3 pb-2"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-kore-gray-light/40 overflow-hidden">
            {/* Sheet header */}
            <div className="px-4 pt-4 pb-2">
              <div className="w-10 h-1 bg-kore-gray-light rounded-full mx-auto mb-3" />
              <p className="text-xs font-semibold text-kore-gray-dark/40 uppercase tracking-wider">
                {openSheet === 'evaluaciones' ? 'Evaluaciones' : 'Más opciones'}
              </p>
            </div>

            {/* Sheet items */}
            <div className="px-2 pb-2">
              {openSheet === 'evaluaciones' &&
                evaluationItems.map((item) => {
                  const allowed = isItemAllowed(item.href);
                  const isActive = pathname === item.href || pathname.startsWith(item.href);
                  return allowed ? (
                    <button
                      key={item.href}
                      onClick={() => handleSheetNavigation(item.href)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-kore-red/10 text-kore-red'
                          : 'text-kore-gray-dark/60 hover:bg-kore-cream hover:text-kore-gray-dark'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                      {pendingMap[item.pendingKey] && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-kore-red animate-pulse" />
                      )}
                    </button>
                  ) : (
                    <span
                      key={item.href}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-kore-gray-dark/25 cursor-not-allowed"
                    >
                      {item.icon}
                      {item.label}
                    </span>
                  );
                })}

              {openSheet === 'mas' && (
                <>
                  {moreNavItems.map((item) => {
                    const allowed = isItemAllowed(item.href);
                    const isActive = pathname === item.href || pathname.startsWith(item.href);
                    return allowed ? (
                      <button
                        key={item.href}
                        onClick={() => handleSheetNavigation(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-kore-red/10 text-kore-red'
                            : 'text-kore-gray-dark/60 hover:bg-kore-cream hover:text-kore-gray-dark'
                        }`}
                      >
                        {item.icon}
                        {item.label}
                        {pendingMap[item.pendingKey] && (
                          <span className="ml-auto w-2 h-2 rounded-full bg-kore-red animate-pulse" />
                        )}
                      </button>
                    ) : (
                      <span
                        key={item.href}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-kore-gray-dark/25 cursor-not-allowed"
                      >
                        {item.icon}
                        {item.label}
                      </span>
                    );
                  })}

                  {/* Divider */}
                  <div className="my-1 border-t border-kore-gray-light/40" />

                  {/* Soporte */}
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-gray-dark/50 hover:bg-kore-cream hover:text-kore-gray-dark transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    Soporte
                  </a>

                  {/* Cerrar sesión */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-gray-dark/50 hover:bg-kore-red/5 hover:text-kore-red transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Cerrar sesión
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 xl:hidden bg-white/95 backdrop-blur-md border-t border-kore-gray-light/40 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {/* Inicio */}
          <Link
            href="/dashboard"
            prefetch={false}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors ${
              pathname === '/dashboard'
                ? 'text-kore-red'
                : 'text-kore-gray-dark/40'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">Inicio</span>
          </Link>

          {/* Agendar */}
          <Link
            href="/book-session"
            prefetch={false}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors ${
              pathname === '/book-session' || pathname.startsWith('/book-session')
                ? 'text-kore-red'
                : 'text-kore-gray-dark/40'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">Agendar</span>
          </Link>

          {/* Evaluaciones (sheet trigger) */}
          <button
            onClick={() => setOpenSheet(openSheet === 'evaluaciones' ? null : 'evaluaciones')}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors ${
              isEvalActive || openSheet === 'evaluaciones'
                ? 'text-kore-red'
                : 'text-kore-gray-dark/40'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">Evaluar</span>
            {hasEvalBadge && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-kore-red animate-pulse" />
            )}
          </button>

          {/* Perfil */}
          <Link
            href="/profile"
            prefetch={false}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors ${
              pathname === '/profile' || pathname.startsWith('/profile')
                ? 'text-kore-red'
                : 'text-kore-gray-dark/40'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">Perfil</span>
          </Link>

          {/* Más (sheet trigger) */}
          <button
            onClick={() => setOpenSheet(openSheet === 'mas' ? null : 'mas')}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors ${
              isMoreActive || openSheet === 'mas'
                ? 'text-kore-red'
                : 'text-kore-gray-dark/40'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">Más</span>
            {hasMoreBadge && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-kore-red animate-pulse" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
