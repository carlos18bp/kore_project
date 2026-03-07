'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/authStore';

export default function ProfileCompletionCTA() {
  const { user, hydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !user || shownRef.current) return;
    if (user.profile_completed) return;
    // Don't show on the profile page itself
    if (pathname === '/profile') return;
    shownRef.current = true;
    setVisible(true);
  }, [hydrated, user, pathname]);

  // Hide CTA once user lands on /profile
  useEffect(() => {
    if (pathname === '/profile' && visible) {
      setVisible(false);
      setNavigating(false);
    }
  }, [pathname, visible]);

  if (!visible) return null;

  const handleDismiss = () => {
    // Only dismiss for current view — will re-appear next visit until profile is completed
    setVisible(false);
  };

  const handleGo = () => {
    setNavigating(true);
    router.push('/profile');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Decorative accent */}
        <div className="absolute -right-8 -top-8 w-32 h-32 opacity-[0.06]">
          <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-kore-red/10 to-kore-burgundy/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>

          <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-3">
            Queremos conocerte mejor
          </h2>
          <p className="text-sm text-kore-gray-dark/60 leading-relaxed mb-6">
            Completa tu perfil para que podamos personalizar tu experiencia y acompañarte mejor en tu proceso.
          </p>

          <button
            onClick={handleGo}
            disabled={navigating}
            className="w-full py-3 px-6 bg-gradient-to-r from-kore-red to-kore-burgundy text-white font-heading font-semibold text-sm rounded-xl hover:shadow-lg transition-all duration-300 mb-3 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {navigating ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Cargando...
              </>
            ) : (
              'Completar mi perfil'
            )}
          </button>

          {!navigating && (
            <button
              onClick={handleDismiss}
              className="text-xs text-kore-gray-dark/40 hover:text-kore-gray-dark/60 transition-colors"
            >
              Ahora no
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
