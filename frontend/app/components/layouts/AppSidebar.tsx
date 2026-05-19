'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';

export type SidebarBadge = 'dot' | number;

export interface SidebarNavItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  badge?: SidebarBadge;
  soon?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onClick?: () => void;
}

export interface SidebarNavGroup {
  label?: string;
  items: SidebarNavItem[];
}

export interface SidebarBottomLink {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}

export interface AppSidebarProps {
  roleLabel: string;
  homeHref: string;
  navGroups: SidebarNavGroup[];
  profileHref?: string;
  userMetaLine?: string;
  bottomLinks?: SidebarBottomLink[];
}

const ITEM_BASE =
  'flex items-center gap-3 px-3.5 py-[11px] rounded-[11px] text-[13px] transition-all duration-150';
const ITEM_ACTIVE =
  'bg-gradient-to-br from-kore-petal/15 to-kore-gold/10 text-kore-ivory border border-kore-gold/30 font-semibold shadow-[0_4px_12px_-6px_rgba(231,200,160,0.30)]';
const ITEM_INACTIVE =
  'text-kore-ivory/70 border border-transparent font-medium hover:bg-kore-ivory/5';

function ItemBody({ item, active }: { item: SidebarNavItem; active: boolean }) {
  return (
    <>
      <span className={active ? 'text-kore-gold' : 'text-kore-gold/55'}>{item.icon}</span>
      <span className="flex-1">{item.label}</span>
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
      {item.soon && (
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-kore-gold/50">
          Pronto
        </span>
      )}
    </>
  );
}

export default function AppSidebar({
  roleLabel,
  homeHref,
  navGroups,
  profileHref,
  userMetaLine,
  bottomLinks,
}: AppSidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
  };

  const isActive = (item: SidebarNavItem) => {
    if (item.disabled || item.soon) return false;
    if (item.href === homeHref) return pathname === homeHref;
    return pathname === item.href || pathname.startsWith(item.href);
  };

  const initialsFromName = (name?: string | null) =>
    name
      ? name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => s[0] ?? '')
          .join('')
          .toUpperCase()
      : '';

  const initials =
    [user?.first_name?.[0], user?.last_name?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() ||
    initialsFromName(user?.name) ||
    roleLabel.charAt(0);

  const displayName =
    user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    roleLabel;

  const secondaryLine = userMetaLine ?? roleLabel;

  const userCardInner = (
    <>
      <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-kore-petal to-kore-gold flex items-center justify-center font-heading text-sm font-bold text-kore-wine-deep flex-shrink-0 overflow-hidden">
        {user?.avatar_url ? (
          <Image src={user.avatar_url} alt="Avatar" fill className="object-cover" sizes="36px" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-kore-ivory truncate">{displayName}</p>
        <p className="text-[10px] text-kore-gold/65 truncate">{secondaryLine}</p>
      </div>
      {profileHref && (
        <span className="text-kore-gold/45 transition-colors group-hover:text-kore-gold flex-shrink-0">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      )}
    </>
  );

  const userCardClasses =
    'group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/40 border border-kore-gold/10 hover:border-kore-gold/25 transition-colors';

  return (
    <aside className="fixed left-0 top-0 h-dvh w-64 bg-gradient-to-br from-kore-wine-deep via-kore-wine-mid to-kore-wine flex-col z-50 hidden xl:flex border-r border-kore-gold/10">
      {/* Logo */}
      <div className="px-6 pt-7 pb-5 border-b border-kore-gold/10">
        <Link href={homeHref} prefetch={false}>
          <span className="font-heading text-2xl font-bold tracking-[0.16em] text-kore-ivory">
            KÓRE
          </span>
        </Link>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.32em] text-kore-gold">
          {roleLabel}
        </div>
      </div>

      {/* User card */}
      {user && (
        <div className="px-3.5 pt-4 pb-2">
          {profileHref ? (
            <Link href={profileHref} prefetch={false} className={userCardClasses}>
              {userCardInner}
            </Link>
          ) : (
            <div className={userCardClasses}>{userCardInner}</div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3.5 pt-3 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && (
              <p className="px-3 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-kore-gold/55">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item);
                const state = active ? ITEM_ACTIVE : ITEM_INACTIVE;
                const inert = item.disabled || item.soon;
                const inertClasses = inert ? 'opacity-55 cursor-not-allowed' : '';
                const body = <ItemBody item={item} active={active} />;

                if (inert) {
                  return (
                    <li key={item.key}>
                      <span
                        aria-disabled="true"
                        title={item.disabledHint}
                        className={`${ITEM_BASE} ${state} ${inertClasses}`}
                      >
                        {body}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      onClick={item.onClick}
                      className={`${ITEM_BASE} ${state}`}
                    >
                      {body}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom links + logout */}
      <div className="px-3.5 pb-5 pt-3 border-t border-kore-gold/10 space-y-1">
        {bottomLinks?.map((link) => {
          const className =
            'flex items-center gap-3 px-3.5 py-[11px] rounded-[11px] text-[13px] text-kore-ivory/70 hover:bg-kore-ivory/5 transition-all duration-150 font-medium';
          const body = (
            <>
              <span className="text-kore-gold/55">{link.icon}</span>
              <span className="flex-1 text-left">{link.label}</span>
            </>
          );
          if (link.href) {
            return link.external ? (
              <a
                key={link.key}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {body}
              </a>
            ) : (
              <Link key={link.key} href={link.href} prefetch={false} className={className}>
                {body}
              </Link>
            );
          }
          return (
            <button
              key={link.key}
              type="button"
              onClick={link.onClick}
              className={`${className} w-full`}
            >
              {body}
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-[11px] rounded-[11px] text-[13px] text-kore-ivory/70 hover:bg-kore-crimson/15 hover:text-kore-ivory transition-all duration-150 font-medium"
        >
          <span className="text-kore-gold/55">
            <svg
              className="w-[18px] h-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.6}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </span>
          <span className="flex-1 text-left">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
