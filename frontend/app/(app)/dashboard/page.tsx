'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import { WHATSAPP_URL } from '@/lib/constants';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { activeSubscription: sub, fetchSubscriptions } = useSubscriptionStore();
  const { upcomingReminder, bookings, fetchUpcomingReminder, fetchBookings } = useBookingStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchSubscriptions();
    fetchUpcomingReminder();
    fetchBookings();
  }, [fetchSubscriptions, fetchUpcomingReminder, fetchBookings]);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  const sessionsRemaining = sub?.sessions_remaining ?? 0;
  const sessionsTotal = sub?.sessions_total ?? 0;
  const program = sub?.package?.title ?? 'Sin programa activo';
  const formattedDate = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Sin agendar';
  const formattedTime = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '';
  const memberDate = sub
    ? new Date(sub.starts_at).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <UpcomingSessionReminder />
      <SubscriptionExpiryReminder />
      <div className="w-full px-6 md:px-10 lg:px-16 pt-8 pb-16">
        {/* Top bar */}
        <div data-hero="badge" className="flex items-center justify-between mb-12">
          <div>
            <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Inicio</p>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
              Hola, {user.name.split(' ')[0]}
            </h1>
          </div>
        </div>

        {/* Stats Grid */}
        <div data-hero="heading" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Program Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
            <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-3">Tu programa</p>
            <p className="font-heading text-xl font-semibold text-kore-wine-dark">{program}</p>
            <p className="text-sm text-kore-gray-dark/50 mt-1">Miembro desde {memberDate}</p>
          </div>

          {/* Sessions Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
            <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-3">Sesiones restantes</p>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl font-semibold text-kore-red">{sessionsRemaining}</span>
              <span className="text-sm text-kore-gray-dark/40">de {sessionsTotal}</span>
            </div>
            <div className="mt-3 h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-kore-red rounded-full transition-all duration-500"
                style={{ width: `${sessionsTotal > 0 ? (sessionsRemaining / sessionsTotal) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Next Session Card */}
          <div className="bg-kore-red rounded-2xl p-6 text-white">
            <p className="text-xs text-white/60 uppercase tracking-widest mb-3">Próxima sesión</p>
            <p className="font-heading text-xl font-semibold capitalize">{formattedDate}</p>
            <p className="text-white/70 text-sm mt-1">{formattedTime}</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div data-hero="body" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Acciones rápidas</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Agendar sesión', icon: '📅', href: '/book-session' },
                  { label: 'Mi suscripción', icon: '💎', href: '/subscription' },
                  { label: 'Mis programas', icon: '📋', href: '/my-programs' },
                  { label: 'Soporte', icon: '💬', href: WHATSAPP_URL },
                ].map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-kore-cream/60 hover:bg-kore-cream transition-colors text-center"
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className="text-xs text-kore-gray-dark/60 font-medium">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Actividad reciente</h2>
              <div className="space-y-4">
                {bookings.length > 0 ? (
                  bookings.slice(0, 4).map((booking) => {
                    const date = new Date(booking.slot.starts_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
                    const statusLabel = booking.status === 'confirmed' ? 'Sesión confirmada'
                      : booking.status === 'canceled' ? 'Sesión cancelada' : 'Sesión pendiente';
                    const desc = booking.package?.title ?? '—';
                    return (
                      <div key={booking.id} className="flex items-start gap-4 py-3 border-b border-kore-gray-light/30 last:border-0">
                        <div className="flex-shrink-0 w-12 text-center">
                          <p className="text-xs text-kore-gray-dark/40">{date}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-kore-gray-dark">{statusLabel}</p>
                          <p className="text-xs text-kore-gray-dark/50 mt-0.5">{desc}</p>
                        </div>
                        <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                          booking.status === 'canceled' ? 'bg-kore-gray-dark/30' : 'bg-kore-red'
                        }`} />
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-kore-gray-dark/40 py-4 text-center">No hay actividad reciente</p>
                )}
              </div>
            </div>
          </div>

          {/* Right - Profile Sidebar */}
          <div data-hero="cta" className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Tu perfil</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-kore-red/10 flex items-center justify-center">
                  <span className="font-heading text-lg font-semibold text-kore-red">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-kore-gray-dark">{user.name}</p>
                  <p className="text-xs text-kore-gray-dark/40">{user.email}</p>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-kore-gray-light/30">
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/40">Programa</span>
                  <span className="text-kore-gray-dark font-medium">{program}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/40">Sesiones</span>
                  <span className="text-kore-gray-dark font-medium">{sessionsRemaining} de {sessionsTotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/40">Miembro desde</span>
                  <span className="text-kore-gray-dark font-medium capitalize">{memberDate}</span>
                </div>
              </div>
            </div>

            {/* Contact Card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">¿Necesitas ayuda?</h2>
              <p className="text-sm text-kore-gray-dark/50 mb-4">
                Escríbenos para reagendar, resolver dudas o ajustar tu programa.
              </p>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark/70 font-medium py-3 rounded-lg transition-colors duration-200 text-sm"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
