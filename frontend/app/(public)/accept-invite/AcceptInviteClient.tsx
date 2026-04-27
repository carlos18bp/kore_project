'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';

type AcceptResult =
  | { accepted: true; subscription_id: number; host_name: string; package_title: string }
  | { requires_login: true; invited_email: string; token: string }
  | { requires_registration: true; invited_email: string; token: string }
  | { error: string };

export default function AcceptInviteClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, hydrate } = useAuthStore();
  const [result, setResult] = useState<AcceptResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) {
      setResult({ error: 'El enlace de invitación no es válido.' });
      setLoading(false);
      return;
    }

    const attempt = async () => {
      try {
        const { data } = await api.post('/subscriptions/accept-invite/', { token });
        setResult(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'No se pudo procesar la invitación.';
        setResult({ error: msg });
      } finally {
        setLoading(false);
      }
    };

    attempt();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" role="status" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kore-cream flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl border border-kore-gray-light/50 p-8 text-center shadow-sm">
        {result && 'accepted' in result && result.accepted && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">¡Invitación aceptada!</h1>
            <p className="text-sm text-kore-gray-dark/60 mb-6">
              Ahora entrenas en el plan <strong>{result.package_title}</strong> junto a <strong>{result.host_name}</strong>.
            </p>
            <Link
              href="/subscription"
              className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Ver mi suscripción
            </Link>
          </>
        )}

        {result && 'requires_login' in result && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-red/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h1 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Inicia sesión para continuar</h1>
            <p className="text-sm text-kore-gray-dark/60 mb-6">
              La invitación es para <strong>{result.invited_email}</strong>. Inicia sesión con esa cuenta para aceptarla.
            </p>
            <Link
              href={`/login?redirect=/accept-invite&token=${result.token}`}
              className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Iniciar sesión
            </Link>
          </>
        )}

        {result && 'requires_registration' in result && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-red/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
            <h1 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Crea tu cuenta para continuar</h1>
            <p className="text-sm text-kore-gray-dark/60 mb-6">
              La invitación es para <strong>{result.invited_email}</strong>. Crea tu cuenta con ese correo para unirte.
            </p>
            <Link
              href={`/register?invite_token=${result.token}`}
              className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Crear cuenta
            </Link>
          </>
        )}

        {result && 'error' in result && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Invitación inválida</h1>
            <p className="text-sm text-kore-gray-dark/60 mb-6">{result.error}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Volver al inicio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
