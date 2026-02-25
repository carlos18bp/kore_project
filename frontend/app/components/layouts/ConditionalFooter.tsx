'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

const ROUTES_WITHOUT_FOOTER = ['/login', '/register', '/checkout'];

export default function ConditionalFooter() {
  const pathname = usePathname();
  const hideFooter = ROUTES_WITHOUT_FOOTER.some(route => pathname?.startsWith(route));

  if (hideFooter) return null;
  return <Footer />;
}
