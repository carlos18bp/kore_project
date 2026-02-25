'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';

const navLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/kore-brand', label: 'Método Kore' },
  { href: '/programs', label: 'Programas' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contacto' },
];

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Hide navbar on checkout flow pages (register/checkout with package param)
  const isCheckoutFlow = (pathname === '/register' || pathname === '/checkout') && searchParams.get('package');
  if (isCheckoutFlow) {
    return null;
  }

  const desktopCtaHref = isAuthenticated ? '/dashboard' : '/login';
  const desktopCtaLabel = isAuthenticated ? 'Mi sesión' : 'Iniciar sesión';

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-kore-cream/90 backdrop-blur-md border-b border-kore-gray-light/50">
      <div className="w-full px-6 md:px-10 lg:px-16 flex items-center justify-between h-20">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/icons/kore-logo.webp"
            alt="KÓRE"
            width={44}
            height={44}
            className="rounded-full w-11 h-11"
          />
          <span className="font-heading text-xl font-semibold text-kore-wine-dark tracking-wide">
            KÓRE
          </span>
        </Link>

        {/* Desktop Links - Centered */}
        <ul className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => (
            <li key={link.href} className="relative">
              <Link
                href={link.href}
                className={`block py-2 font-medium text-sm tracking-wide uppercase transition-colors duration-200 ${
                  isActive(link.href)
                    ? 'text-kore-red'
                    : 'text-kore-gray-dark hover:text-kore-red'
                }`}
              >
                {link.label}
              </Link>
              {/* Active indicator bar */}
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-kore-red rounded-full transition-all duration-300 ${
                  isActive(link.href) ? 'w-full' : 'w-0'
                }`}
              />
            </li>
          ))}
        </ul>

        {/* CTA Desktop */}
        <div className="hidden md:block shrink-0">
          <Link
            href={desktopCtaHref}
            className="inline-flex items-center justify-center border-2 border-kore-red text-kore-red hover:bg-kore-red hover:text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors duration-200"
          >
            {desktopCtaLabel}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden flex flex-col justify-center items-center gap-1.5 w-10 h-10"
          aria-label="Menú"
        >
          <span
            className={`block w-6 h-0.5 bg-kore-gray-dark transition-all duration-300 ${
              mobileOpen ? 'rotate-45 translate-y-2' : ''
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-kore-gray-dark transition-all duration-300 ${
              mobileOpen ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-kore-gray-dark transition-all duration-300 ${
              mobileOpen ? '-rotate-45 -translate-y-2' : ''
            }`}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        data-testid="mobile-nav-menu"
        className={`md:hidden overflow-hidden transition-all duration-300 bg-kore-cream/95 backdrop-blur-md ${
          mobileOpen ? 'max-h-80 border-b border-kore-gray-light/50' : 'max-h-0'
        }`}
      >
        <ul className="flex flex-col px-6 py-4 gap-4">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block font-medium text-base tracking-wide transition-colors duration-200 ${
                  isActive(link.href)
                    ? 'text-kore-red border-l-2 border-kore-red pl-3'
                    : 'text-kore-gray-dark hover:text-kore-red'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="pt-2">
            <Link
              href={desktopCtaHref}
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center border-2 border-kore-red text-kore-red hover:bg-kore-red hover:text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors duration-200"
            >
              {desktopCtaLabel}
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
