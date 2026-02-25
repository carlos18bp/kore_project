'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import { WHATSAPP_URL } from '@/lib/constants';

// Brand icons as SVG components
const CalendarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const CardIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

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

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    const greetings = {
      morning: ['Buenos días', 'Qué bueno verte temprano', 'Arrancamos bien el día'],
      afternoon: ['Buenas tardes', 'Hola de nuevo', 'Seguimos adelante'],
      evening: ['Buenas noches', 'Hola', 'Qué bueno tenerte aquí'],
    };
    const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const options = greetings[period];
    const dayHash = new Date().getDate() % options.length;
    return options[dayHash];
  };

  // Progress-focused motivational messages
  const getProgressMessage = (sessionsUsed: number, progressPercent: number) => {
    if (sessionsUsed === 0) {
      return "Tu camino hacia una mejor versión de ti comienza hoy. Cada paso cuenta.";
    } else if (progressPercent < 25) {
      return "Has dado los primeros pasos. La constancia construye resultados duraderos.";
    } else if (progressPercent < 50) {
      return "Estás avanzando de forma constante. Cada sesión fortalece tu cuerpo y tu confianza.";
    } else if (progressPercent < 75) {
      return "Más de la mitad del camino recorrido. Tu dedicación está dando frutos.";
    } else if (progressPercent < 100) {
      return "Casi llegas a la meta de este ciclo. Tu transformación es evidente.";
    } else {
      return "Has completado tu programa. Tu compromiso ha sido extraordinario.";
    }
  };

  // Get progress stage label
  const getProgressStage = (progressPercent: number) => {
    if (progressPercent < 25) return 'Inicio';
    if (progressPercent < 50) return 'Construcción';
    if (progressPercent < 75) return 'Consolidación';
    if (progressPercent < 100) return 'Dominio';
    return 'Completado';
  };

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  const sessionsRemaining = sub?.sessions_remaining ?? 0;
  const sessionsTotal = sub?.sessions_total ?? 0;
  const sessionsUsed = sub?.sessions_used ?? 0;
  const progressPercent = sessionsTotal > 0 ? Math.round((sessionsUsed / sessionsTotal) * 100) : 0;
  const program = sub?.package?.title ?? 'Sin programa activo';
  const formattedDate = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const formattedTime = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '';
  const memberDate = sub
    ? new Date(sub.starts_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const quickActions = [
    { label: 'Mi suscripción', icon: <CardIcon />, href: '/subscription' },
    { label: 'Mis programas', icon: <ClipboardIcon />, href: '/my-programs' },
    { label: 'Soporte', icon: <ChatIcon />, href: WHATSAPP_URL },
  ];

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream relative overflow-hidden">
      {/* Organic decorative element */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none lg:w-96 lg:h-96">
        <Image
          src="/images/flower_leaves.webp"
          alt=""
          fill
          className="object-contain"
        />
      </div>

      <UpcomingSessionReminder />
      <SubscriptionExpiryReminder />

      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 lg:pt-8 pb-16 relative z-10">
        {/* Top bar with greeting */}
        <div data-hero="badge" className="mb-8 lg:mb-12">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu espacio</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            {getGreeting()}, {user.name.split(' ')[0]}
          </h1>
        </div>

        {/* MOBILE: Prominent CTA - Agendar sesión */}
        <div className="lg:hidden mb-6">
          <Link
            href="/book-session"
            className="group flex items-center justify-between w-full bg-gradient-to-r from-kore-red to-kore-burgundy text-white p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <CalendarIcon />
              </div>
              <div>
                <p className="font-heading text-lg font-semibold">Agendar sesión</p>
                <p className="text-sm text-white/70">Continúa tu progreso</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ArrowRightIcon />
            </div>
          </Link>
        </div>

        {/* Progress Message Card - Mobile only */}
        <div data-hero="heading" className="mb-6 lg:hidden">
          <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm rounded-3xl p-6 border border-white/60 shadow-sm overflow-hidden">
            {/* Subtle organic accent */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 opacity-5">
              <Image src="/images/flower.webp" alt="" fill className="object-contain" />
            </div>
            
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-kore-gray-dark/90 leading-relaxed font-medium">
                  {getProgressMessage(sessionsUsed, progressPercent)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Stats - Mobile optimized cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Program Progress Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium">Tu progreso</p>
              <span className="text-xs text-green-700 font-semibold bg-green-100 px-2.5 py-1 rounded-full">
                {getProgressStage(progressPercent)}
              </span>
            </div>
            
            {/* Circular Progress */}
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E5E5E5"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="3"
                    strokeDasharray={`${progressPercent}, 100`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#670F22" />
                      <stop offset="100%" stopColor="#AB0D2F" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-heading text-xl font-bold text-kore-gray-dark">{progressPercent}%</span>
                </div>
              </div>
              <div>
                <p className="font-heading text-lg font-semibold text-kore-gray-dark">{sessionsUsed} sesiones</p>
                <p className="text-sm text-kore-gray-dark/50">completadas de {sessionsTotal}</p>
              </div>
            </div>
          </div>

          {/* Program Info Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium mb-4">Tu programa</p>
            <p className="font-heading text-xl font-semibold text-kore-red mb-2">{program}</p>
            <p className="text-sm text-kore-gray-dark/50">Miembro desde {memberDate}</p>
            <div className="mt-4 pt-4 border-t border-kore-gray-light/30">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-kore-red/60"></span>
                <span className="text-kore-gray-dark/60">Total de entrenamientos: <span className="font-semibold text-kore-gray-dark">{sessionsUsed}</span></span>
              </div>
            </div>
          </div>

          {/* Next Session Card - DESKTOP prominent CTA */}
          <div className="hidden lg:block">
            {formattedDate ? (
              <div className="bg-gradient-to-br from-kore-red to-kore-burgundy rounded-2xl p-6 text-white h-full">
                <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-4">Próxima sesión</p>
                <p className="font-heading text-xl font-semibold capitalize mb-1">{formattedDate}</p>
                <p className="text-white/70 text-sm">{formattedTime}</p>
              </div>
            ) : (
              <Link
                href="/book-session"
                className="group flex flex-col justify-between bg-gradient-to-br from-kore-red to-kore-burgundy rounded-2xl p-6 text-white h-full hover:shadow-lg transition-shadow"
              >
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-4">Tu siguiente paso</p>
                  <p className="font-heading text-xl font-semibold mb-1">Agendar sesión</p>
                  <p className="text-white/70 text-sm">Continúa tu transformación</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                  <span>Reservar ahora</span>
                  <ArrowRightIcon />
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* MOBILE: Next Session if exists */}
        {formattedDate && (
          <div className="lg:hidden mb-6">
            <div className="bg-gradient-to-br from-kore-red/90 to-kore-burgundy rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-2">Próxima sesión</p>
                  <p className="font-heading text-lg font-semibold capitalize">{formattedDate}</p>
                  <p className="text-white/70 text-sm">{formattedTime}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <CalendarIcon />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div data-hero="body" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Quick Actions & Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions - Brand icons, no emojis */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Acciones rápidas</h2>
              <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-kore-cream/50 hover:bg-kore-cream border border-transparent hover:border-kore-gray-light/30 transition-all text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-kore-red shadow-sm group-hover:shadow-md transition-shadow">
                      {action.icon}
                    </div>
                    <span className="text-xs text-kore-gray-dark/70 font-medium">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Tu historial</h2>
              <div className="space-y-1">
                {bookings.length > 0 ? (
                  bookings.slice(0, 4).map((booking) => {
                    const date = new Date(booking.slot.starts_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
                    const statusLabel = booking.status === 'confirmed' ? 'Sesión completada'
                      : booking.status === 'canceled' ? 'Sesión cancelada' : 'Sesión agendada';
                    const desc = booking.package?.title ?? '—';
                    return (
                      <div key={booking.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-kore-cream/50 transition-colors">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          booking.status === 'canceled' ? 'bg-kore-gray-light/50' 
                            : booking.status === 'confirmed' ? 'bg-green-100' 
                            : 'bg-amber-100'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            booking.status === 'canceled' ? 'text-kore-gray-dark/40' 
                              : booking.status === 'confirmed' ? 'text-green-600' 
                              : 'text-amber-600'
                          }`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            {booking.status === 'confirmed' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : booking.status === 'canceled' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-kore-gray-dark truncate">{statusLabel}</p>
                          <p className="text-xs text-kore-gray-dark/50">{desc}</p>
                        </div>
                        <p className="text-xs text-kore-gray-dark/40 capitalize">{date}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-kore-cream mx-auto mb-4 flex items-center justify-center">
                      <CalendarIcon />
                    </div>
                    <p className="text-sm text-kore-gray-dark/50">Tu historial aparecerá aquí</p>
                    <Link href="/book-session" className="text-sm text-kore-red font-medium mt-2 inline-block hover:underline">
                      Agenda tu primera sesión
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right - Profile Sidebar */}
          <div data-hero="cta" className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Tu perfil</h2>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center ring-2 ring-white shadow-sm">
                  <span className="font-heading text-xl font-semibold text-kore-red">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-kore-gray-dark">{user.name}</p>
                  <p className="text-xs text-kore-gray-dark/40">{user.email}</p>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-kore-gray-light/30">
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/50">Programa</span>
                  <span className="text-kore-gray-dark font-medium">{program}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/50">Entrenamientos</span>
                  <span className="text-kore-gray-dark font-medium">{sessionsUsed} de {sessionsTotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/50">Miembro desde</span>
                  <span className="text-kore-gray-dark font-medium capitalize">{memberDate}</span>
                </div>
              </div>
            </div>

            {/* Progress Message Card - Desktop only */}
            <div className="hidden lg:block relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm overflow-hidden">
              {/* Subtle organic accent */}
              <div className="absolute -right-6 -bottom-6 w-24 h-24 opacity-5">
                <Image src="/images/flower.webp" alt="" fill className="object-contain" />
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium mb-2">Tu progreso</p>
                  <p className="text-sm text-kore-gray-dark/90 leading-relaxed">
                    {getProgressMessage(sessionsUsed, progressPercent)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
