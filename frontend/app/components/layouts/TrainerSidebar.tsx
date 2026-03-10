'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { WHATSAPP_URL } from '@/lib/constants';

const navItems = [
  {
    label: 'Inicio',
    href: '/trainer/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: 'Mis Clientes',
    href: '/trainer/clients',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

export default function TrainerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 xl:hidden p-2 rounded-xl bg-white/80 backdrop-blur-sm border border-kore-gray-light/40 text-kore-gray-dark/60 hover:text-kore-gray-dark transition-colors"
        aria-label="Abrir menú"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 xl:hidden cursor-pointer"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 h-dvh w-64 bg-white border-r border-kore-gray-light/40 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } xl:translate-x-0`}>
      {/* Logo */}
      <div className="px-6 pt-8 pb-6 flex items-center justify-between">
        <Link href="/trainer/dashboard" prefetch={false}>
          <span className="font-heading text-2xl font-semibold text-kore-gray-dark tracking-tight">
            KÓRE
          </span>
        </Link>
        <button
          onClick={() => setIsOpen(false)}
          className="xl:hidden p-1 rounded-lg text-kore-gray-dark/40 hover:text-kore-gray-dark transition-colors"
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* User Info */}
      {user && (
        <div className="px-6 pb-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
              <span className="font-heading text-sm font-semibold text-kore-red">
                {user.name.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-kore-gray-dark truncate">{user.name}</p>
              <p className="text-xs text-kore-red/70 truncate font-medium">Entrenador</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/trainer/dashboard' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-kore-red/10 text-kore-red'
                      : 'text-kore-gray-dark/50 hover:bg-kore-cream hover:text-kore-gray-dark'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="px-3 pb-6 space-y-1">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-gray-dark/40 hover:bg-kore-cream hover:text-kore-gray-dark transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          Soporte
        </a>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-gray-dark/40 hover:bg-kore-red/5 hover:text-kore-red transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
    </>
  );
}
