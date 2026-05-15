'use client';

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';

export type MobileNavBadge = 'dot' | number;

export interface MobileNavTab {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  match: (pathname: string) => boolean;
  badge?: MobileNavBadge;
  disabled?: boolean;
}

export interface MobileNavMoreItem {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: MobileNavBadge;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}

export interface AppMobileBottomNavProps {
  tabs: MobileNavTab[];
  moreItems?: MobileNavMoreItem[];
  /** Label shown under the sheet trigger button and as the sheet section heading. Defaults to "Más". */
  moreLabel?: string;
  /** Icon for the sheet trigger. Defaults to a grid/menu icon. */
  moreIcon?: ReactNode;
  /** Position where the sheet trigger appears in the bottom bar (0-based). Defaults to the end. */
  moreTabAt?: number;
  /** Badge shown on the sheet trigger button (e.g. aggregate pending dot). */
  moreTabBadge?: MobileNavBadge;
  /** If true, the sheet includes a "Cerrar sesión" button at the end. Defaults to true. */
  showLogout?: boolean;
}

const MoreIcon = (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

const LogoutIcon = (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

function Badge({ badge }: { badge: MobileNavBadge }) {
  if (badge === 'dot') {
    return (
      <span
        className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-kore-crimson animate-pulse"
        aria-hidden="true"
      />
    );
  }
  if (typeof badge === 'number' && badge > 0) {
    return (
      <span className="absolute top-1 right-1/4 min-w-[16px] h-4 rounded-full bg-kore-crimson text-kore-ivory text-[9px] font-bold flex items-center justify-center px-1">
        {badge > 99 ? '99+' : badge}
      </span>
    );
  }
  return null;
}

export default function AppMobileBottomNav({
  tabs,
  moreItems,
  moreLabel,
  moreIcon,
  moreTabAt,
  moreTabBadge,
  showLogout = true,
}: AppMobileBottomNavProps) {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sheetOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setSheetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sheetOpen]);

  const handleLogout = () => {
    logout();
  };

  const hasMore = (moreItems && moreItems.length > 0) || showLogout;
  const tabBase =
    'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg active:scale-95 transition-transform duration-100';

  return (
    <>
      {/* Backdrop */}
      {sheetOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 xl:hidden"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Sheet "Más" */}
      {sheetOpen && (
        <div
          ref={sheetRef}
          className="fixed bottom-16 left-0 right-0 z-50 xl:hidden px-3 pb-2"
        >
          <div className="bg-gradient-to-br from-kore-wine-deep via-kore-wine-mid to-kore-wine rounded-2xl shadow-xl border border-kore-gold/15 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="w-10 h-1 bg-kore-gold/30 rounded-full mx-auto mb-3" />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-gold/55">
                {moreLabel ?? 'Más opciones'}
              </p>
            </div>
            <div className="px-2 pb-3 space-y-0.5">
              {moreItems?.map((item) => {
                const className =
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-ivory/70 hover:bg-kore-ivory/5 hover:text-kore-ivory transition-all duration-150 font-medium';
                const body = (
                  <>
                    <span className="text-kore-gold/55">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge === 'dot' && (
                      <span
                        className="w-2 h-2 rounded-full bg-kore-crimson animate-pulse"
                        aria-hidden="true"
                      />
                    )}
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="min-w-[20px] h-5 rounded-full bg-kore-crimson text-kore-ivory text-[10px] font-bold flex items-center justify-center px-1.5">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </>
                );
                if (item.href) {
                  return item.external ? (
                    <a
                      key={item.key}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={className}
                    >
                      {body}
                    </a>
                  ) : (
                    <Link
                      key={item.key}
                      href={item.href}
                      prefetch={false}
                      className={className}
                    >
                      {body}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className={className}
                  >
                    {body}
                  </button>
                );
              })}
              {showLogout && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-kore-ivory/70 hover:bg-kore-crimson/15 hover:text-kore-ivory transition-all duration-150 font-medium"
                >
                  <span className="text-kore-gold/55">{LogoutIcon}</span>
                  <span className="flex-1 text-left">Cerrar sesión</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 xl:hidden bg-gradient-to-br from-kore-wine-deep via-kore-wine-mid to-kore-wine border-t border-kore-gold/15 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {(() => {
            const tabElements: ReactElement[] = tabs.map((tab) => {
              const active = tab.match(pathname);
              const colorClass = tab.disabled
                ? 'text-kore-ivory/20 pointer-events-none'
                : active
                  ? 'text-kore-gold'
                  : 'text-kore-ivory/45';
              return (
                <Link
                  key={tab.key}
                  href={tab.disabled ? '#' : tab.href}
                  prefetch={false}
                  className={`${tabBase} ${colorClass}`}
                >
                  {tab.icon}
                  <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
                  {tab.badge !== undefined && <Badge badge={tab.badge} />}
                </Link>
              );
            });

            if (hasMore) {
              const moreElement = (
                <button
                  key="__more__"
                  type="button"
                  onClick={() => setSheetOpen((v) => !v)}
                  className={`${tabBase} ${sheetOpen ? 'text-kore-gold' : 'text-kore-ivory/45'}`}
                >
                  {moreIcon ?? MoreIcon}
                  <span className="text-[10px] font-medium leading-tight">
                    {moreLabel ?? 'Más'}
                  </span>
                  {moreTabBadge !== undefined && <Badge badge={moreTabBadge} />}
                </button>
              );
              const pos = Math.min(
                Math.max(moreTabAt ?? tabElements.length, 0),
                tabElements.length,
              );
              tabElements.splice(pos, 0, moreElement);
            }

            return tabElements;
          })()}
        </div>
      </nav>
    </>
  );
}
