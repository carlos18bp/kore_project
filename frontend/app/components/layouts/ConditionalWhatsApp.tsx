'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import WhatsAppButton from '../WhatsAppButton';

const ROUTES_WITH_WHATSAPP = ['/', '/kore-brand', '/programs', '/faq', '/contact'];

export default function ConditionalWhatsApp() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handleVisibility = (e: CustomEvent<{ hidden: boolean }>) => {
      setHidden(e.detail.hidden);
    };
    window.addEventListener('whatsapp-visibility', handleVisibility as EventListener);
    return () => window.removeEventListener('whatsapp-visibility', handleVisibility as EventListener);
  }, []);

  const showWhatsApp = ROUTES_WITH_WHATSAPP.some(route => 
    route === '/' ? pathname === '/' : pathname?.startsWith(route)
  );

  if (!showWhatsApp || hidden) return null;
  return <WhatsAppButton />;
}
