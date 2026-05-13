'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { WHATSAPP_URL } from '@/lib/constants';

export default function TrainerMobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { riskDashboard } = useTrainerStore();
  const alertCount = riskDashboard?.risk_summary?.alto ?? 0;

  const [openSheet, setOpenSheet] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenSheet(false);
  }, [pathname]);

  useEffect(() => {
    if (!openSheet) return;
    const handleClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpenSheet(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openSheet]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const tabs = [
    {
      label: 'Inicio',
      href: '/trainer/dashboard',
      match: (p: string) => p === '/trainer/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      label: 'Clientes',
      href: '/trainer/clients',
      match: (p: string) => p === '/trainer/clients' || p.startsWith('/trainer/clients'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      label: 'Alertas',
      href: '/trainer/alerts',
      match: (p: string) => p === '/trainer/alerts' || p.startsWith('/trainer/alerts'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      ),
      badge: alertCount,
    },
    {
      label: 'Métricas',
      href: '/trainer/metrics',
      match: (p: string) => p === '/trainer/metrics' || p.startsWith('/trainer/metrics'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {openSheet && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 xl:hidden"
          onClick={() => setOpenSheet(false)}
        />
      )}

      {/* Bottom Sheet — Más */}
      {openSheet && (
        <div
          ref={sheetRef}
          className="fixed bottom-16 left-0 right-0 z-50 xl:hidden px-3 pb-2"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-kore-gray-light/40 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="w-10 h-1 bg-kore-gray-light rounded-full mx-auto mb-3" />
              <p className="text-xs font-semibold text-kore-gray-dark/40 uppercase tracking-wider">
                Más opciones
              </p>
            </div>
            <div className="px-2 pb-2">
              <Link
                href="/trainer/evidence"
                prefetch={false}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-gray-dark/60 hover:bg-kore-cream hover:text-kore-gray-dark transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                Evidencia
              </Link>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-gray-dark/60 hover:bg-kore-cream hover:text-kore-gray-dark transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                Soporte
              </a>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-gray-dark/50 hover:bg-kore-red/5 hover:text-kore-red transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 xl:hidden bg-white/95 backdrop-blur-md border-t border-kore-gray-light/40 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {tabs.map((tab) => {
            const isActive = tab.match(pathname);
            const badge = ('badge' in tab ? tab.badge : 0) ?? 0;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={false}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg active:scale-95 transition-transform duration-100 ${
                  isActive ? 'text-kore-red' : 'text-kore-gray-dark/40'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-1/4 min-w-[16px] h-4 rounded-full bg-kore-red text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Más */}
          <button
            onClick={() => setOpenSheet(!openSheet)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg active:scale-95 transition-transform duration-100 ${
              openSheet ? 'text-kore-red' : 'text-kore-gray-dark/40'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
