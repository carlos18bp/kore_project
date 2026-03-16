'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import SubscriptionDashboardToast from '@/app/components/subscription/SubscriptionDashboardToast';
import { WHATSAPP_URL } from '@/lib/constants';
import {
  getGoalLabel, getGoalIcon, getMoodLabel, getMoodIcon,
  MOOD_COLORS, MOOD_MESSAGES,
} from '@/app/components/profile/ProfileIcons';

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
  const { profile, todayMood, fetchProfile } = useProfileStore();
  const { evaluations: anthroEvals, fetchMyEvaluations } = useAnthropometryStore();
  const { evaluations: posturoEvals, fetchMyEvaluations: fetchMyPosturoEvals } = usePosturometryStore();
  const { evaluations: physicalEvals, fetchMyEvaluations: fetchMyPhysicalEvals } = usePhysicalEvaluationStore();
  const sectionRef = useRef<HTMLElement>(null);
  const profileFetchedRef = useRef(false);
  useHeroAnimation(sectionRef);
  const anthroDotsRef = useRef<HTMLDivElement>(null);
  const posturoDotsRef = useRef<HTMLDivElement>(null);
  const physicalDotsRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<HTMLDivElement>(null);
  const mobileBubblesRef = useRef<HTMLDivElement>(null);

  // Computed variables (must be before GSAP effects that depend on them)
  const sessionsRemaining = sub?.sessions_remaining ?? 0;
  const sessionsTotal = sub?.sessions_total ?? 0;
  const sessionsUsed = sub?.sessions_used ?? 0;
  const progressPercent = sessionsTotal > 0 ? Math.round((sessionsUsed / sessionsTotal) * 100) : 0;
  const program = sub?.package?.title ?? 'Sin programa activo';
  const formattedDate = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const formattedTime = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
  const memberDate = sub
    ? new Date(sub.starts_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  useEffect(() => {
    fetchSubscriptions();
    fetchUpcomingReminder();
    fetchBookings();
    fetchMyEvaluations();
    fetchMyPosturoEvals();
    fetchMyPhysicalEvals();
  }, [fetchSubscriptions, fetchUpcomingReminder, fetchBookings, fetchMyEvaluations, fetchMyPosturoEvals, fetchMyPhysicalEvals]);

  useEffect(() => {
    if (profileFetchedRef.current) return;
    profileFetchedRef.current = true;
    fetchProfile();
  }, [fetchProfile]);

  // GSAP floating bubbles animation for CTA cards (desktop + mobile)
  useEffect(() => {
    const refs = [bubblesRef.current, mobileBubblesRef.current].filter(Boolean);
    if (!refs.length) return;
    const ctx = gsap.context(() => {
      refs.forEach((container) => {
        const bubbles = container!.querySelectorAll('.cta-bubble');
        bubbles.forEach((bubble) => {
          const startX = Math.random() * 100;
          const startY = Math.random() * 100;
          const size = 80 + Math.random() * 140;
          gsap.set(bubble, {
            left: `${startX}%`,
            top: `${startY}%`,
            width: size,
            height: size,
            xPercent: -50,
            yPercent: -50,
            opacity: 0.15 + Math.random() * 0.25,
          });
          gsap.to(bubble, {
            x: `random(-80, 80)`,
            y: `random(-50, 50)`,
            scale: `random(0.7, 1.6)`,
            opacity: `random(0.2, 0.55)`,
            duration: `random(5, 10)`,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: Math.random() * 2,
          });
        });
      });
    });
    return () => ctx.revert();
  }, [formattedDate]);

  // GSAP smooth pulse animation for anthropometry dots
  useEffect(() => {
    if (!anthroEvals.length) return;
    const raf = requestAnimationFrame(() => {
      if (!anthroDotsRef.current) return;
      const dots = anthroDotsRef.current.querySelectorAll('.anthro-wave-dot');
      if (!dots.length) return;
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.inOut' } });
      dots.forEach((dot, i) => {
        tl.to(dot, { y: -4, scale: 1.6, opacity: 0.5, duration: 0.5 }, i * 0.18)
          .to(dot, { y: 0, scale: 1, opacity: 1, duration: 0.5 }, i * 0.18 + 0.5);
      });
      (anthroDotsRef.current as HTMLElement & { _gsapTl?: gsap.core.Timeline })._gsapTl = tl;
    });
    return () => {
      cancelAnimationFrame(raf);
      const el = anthroDotsRef.current as HTMLElement & { _gsapTl?: gsap.core.Timeline } | null;
      if (el?._gsapTl) el._gsapTl.kill();
    };
  }, [anthroEvals]);

  // GSAP smooth pulse animation for posturometry dots
  useEffect(() => {
    if (!posturoEvals.length) return;
    const raf = requestAnimationFrame(() => {
      if (!posturoDotsRef.current) return;
      const dots = posturoDotsRef.current.querySelectorAll('.posturo-wave-dot');
      if (!dots.length) return;
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.inOut' } });
      dots.forEach((dot, i) => {
        tl.to(dot, { y: -4, scale: 1.6, opacity: 0.5, duration: 0.5 }, i * 0.18)
          .to(dot, { y: 0, scale: 1, opacity: 1, duration: 0.5 }, i * 0.18 + 0.5);
      });
      (posturoDotsRef.current as HTMLElement & { _gsapTl?: gsap.core.Timeline })._gsapTl = tl;
    });
    return () => {
      cancelAnimationFrame(raf);
      const el = posturoDotsRef.current as HTMLElement & { _gsapTl?: gsap.core.Timeline } | null;
      if (el?._gsapTl) el._gsapTl.kill();
    };
  }, [posturoEvals]);

  // GSAP smooth pulse animation for physical evaluation dots
  useEffect(() => {
    if (!physicalEvals.length) return;
    const raf = requestAnimationFrame(() => {
      if (!physicalDotsRef.current) return;
      const dots = physicalDotsRef.current.querySelectorAll('.physical-wave-dot');
      if (!dots.length) return;
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.inOut' } });
      dots.forEach((dot, i) => {
        tl.to(dot, { y: -4, scale: 1.6, opacity: 0.5, duration: 0.5 }, i * 0.18)
          .to(dot, { y: 0, scale: 1, opacity: 1, duration: 0.5 }, i * 0.18 + 0.5);
      });
      (physicalDotsRef.current as HTMLElement & { _gsapTl?: gsap.core.Timeline })._gsapTl = tl;
    });
    return () => {
      cancelAnimationFrame(raf);
      const el = physicalDotsRef.current as HTMLElement & { _gsapTl?: gsap.core.Timeline } | null;
      if (el?._gsapTl) el._gsapTl.kill();
    };
  }, [physicalEvals]);

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
      <SubscriptionDashboardToast />

      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16 relative z-10">
        {/* Top bar with greeting */}
        <div data-hero="badge" className="mb-8 xl:mb-12">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu espacio</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            {getGreeting()}, {user.name.split(' ')[0]}
          </h1>
        </div>

        {/* MOBILE: Prominent CTA - Agendar sesión — with animated bubbles + grain */}
        <div className="xl:hidden mb-6">
          <Link
            href="/book-session"
            className="group relative flex items-center justify-between w-full text-white p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-kore-red via-kore-crimson to-kore-burgundy" />
            <div ref={mobileBubblesRef} className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="cta-bubble absolute rounded-full"
                  style={{
                    background: i % 5 === 0
                      ? 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)'
                      : i % 5 === 1
                      ? 'radial-gradient(circle, rgba(255,200,200,0.22) 0%, transparent 70%)'
                      : i % 5 === 2
                      ? 'radial-gradient(circle, rgba(255,150,170,0.20) 0%, transparent 70%)'
                      : i % 5 === 3
                      ? 'radial-gradient(circle, rgba(255,220,210,0.18) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(255,180,190,0.20) 0%, transparent 70%)',
                    filter: 'blur(12px)',
                  }}
                />
              ))}
            </div>
            <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '128px 128px' }} />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <CalendarIcon />
              </div>
              <div>
                <p className="font-heading text-lg font-semibold">Agendar sesión</p>
                <p className="text-sm text-white/70">Continúa tu progreso</p>
              </div>
            </div>
            <div className="relative z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ArrowRightIcon />
            </div>
          </Link>
        </div>

        {/* Progress Message Card - Mobile only */}
        <div data-hero="heading" className="mb-6 xl:hidden">
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

        {/* ══════ STRUCTURED GRID DASHBOARD ══════ */}
        <div data-hero="body" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {/* ① Progress + Goal — tall card spanning 2 rows on xl */}
          <div className="xl:row-span-2 bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium">Tu progreso</p>
              <span className="text-xs text-green-700 font-semibold bg-green-100 px-2.5 py-1 rounded-full">
                {getProgressStage(progressPercent)}
              </span>
            </div>
            <div className="flex items-center gap-5 mb-5">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E5E5" strokeWidth="3" />
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#progressGradient)" strokeWidth="3" strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" />
                  <defs><linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#670F22" /><stop offset="100%" stopColor="#AB0D2F" /></linearGradient></defs>
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
            {/* Mi objetivo (inline) */}
            {(() => {
              const goalValue = profile?.customer_profile?.primary_goal;
              const GoalIcon = goalValue ? getGoalIcon(goalValue) : null;
              return (
                <div className="py-4 border-t border-kore-gray-light/30">
                  {goalValue && GoalIcon ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                        <GoalIcon className="w-5 h-5 text-kore-red" />
                      </div>
                      <div>
                        <p className="text-[10px] text-kore-gray-dark/40 uppercase tracking-wider mb-0.5">Mi objetivo</p>
                        <span className="text-sm font-medium text-kore-gray-dark">{getGoalLabel(goalValue)}</span>
                      </div>
                    </div>
                  ) : (
                    <Link href="/profile" className="text-sm text-kore-red hover:underline">Define tu objetivo</Link>
                  )}
                </div>
              );
            })()}
            {/* Estado de hoy (embedded) */}
            <div className="py-4 border-t border-kore-gray-light/30">
              {todayMood ? (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-heading text-base font-bold flex-shrink-0 ${
                    todayMood.score >= 7 ? 'bg-green-100 text-green-700' : todayMood.score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                  }`}>{todayMood.score}</div>
                  <div>
                    <p className="text-[10px] text-kore-gray-dark/40 uppercase tracking-wider mb-0.5">Estado de hoy</p>
                    <p className={`text-sm font-medium ${todayMood.score >= 7 ? 'text-green-700' : todayMood.score >= 4 ? 'text-amber-700' : 'text-red-600'}`}>
                      {todayMood.score >= 9 ? 'Excelente' : todayMood.score >= 7 ? 'Bien' : todayMood.score >= 5 ? 'Regular' : todayMood.score >= 3 ? 'Bajo' : 'Muy bajo'}
                      <span className="text-kore-gray-dark/40 text-[10px] font-normal ml-1">de 10</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-kore-cream flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-kore-gray-dark/40 uppercase tracking-wider mb-0.5">Estado de hoy</p>
                    <Link href="/profile" className="text-xs text-kore-red font-medium hover:underline">Registra cómo te sientes</Link>
                  </div>
                </div>
              )}
            </div>
            {/* Tu motivación */}
            <div className="flex items-start gap-3 mt-auto pt-4 border-t border-kore-gray-light/30">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-purple-600/80 uppercase tracking-wider font-semibold mb-1">Tu motivación</p>
                <p className="text-xs text-kore-gray-dark/70 leading-relaxed">{getProgressMessage(sessionsUsed, progressPercent)}</p>
              </div>
            </div>
          </div>

          {/* ② CTA: Agendar / Próxima sesión — with animated bubbles + grain */}
          {formattedDate ? (
            <div className="relative rounded-2xl p-6 text-white overflow-hidden">
              {/* Base gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-kore-red via-kore-crimson to-kore-burgundy" />
              {/* Animated bubbles */}
              <div ref={bubblesRef} className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="cta-bubble absolute rounded-full opacity-30"
                    style={{
                      background: i % 5 === 0
                        ? 'radial-gradient(circle, rgba(255,64,64,0.7) 0%, transparent 70%)'
                        : i % 5 === 1
                        ? 'radial-gradient(circle, rgba(171,13,47,0.6) 0%, transparent 70%)'
                        : i % 5 === 2
                        ? 'radial-gradient(circle, rgba(255,118,118,0.5) 0%, transparent 70%)'
                        : i % 5 === 3
                        ? 'radial-gradient(circle, rgba(194,0,0,0.5) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(205,12,54,0.6) 0%, transparent 70%)',
                      filter: 'blur(6px)',
                    }}
                  />
                ))}
              </div>
              {/* Grain overlay */}
              <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '128px 128px' }} />
              {/* Content */}
              <div className="relative z-10">
                <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-3">Próxima sesión</p>
                <p className="font-heading text-xl font-semibold capitalize mb-1">{formattedDate}</p>
                <p className="text-white/70 text-sm mb-3">{formattedTime}</p>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <CalendarIcon />
                  <span>{upcomingReminder?.trainer ? `${upcomingReminder.trainer.first_name} ${upcomingReminder.trainer.last_name}`.trim() : program}</span>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/book-session" className="group relative block rounded-2xl p-6 text-white overflow-hidden hover:shadow-lg transition-shadow">
              {/* Base gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-kore-red via-kore-crimson to-kore-burgundy" />
              {/* Animated bubbles */}
              <div ref={bubblesRef} className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="cta-bubble absolute rounded-full opacity-30"
                    style={{
                      background: i % 5 === 0
                        ? 'radial-gradient(circle, rgba(255,64,64,0.7) 0%, transparent 70%)'
                        : i % 5 === 1
                        ? 'radial-gradient(circle, rgba(171,13,47,0.6) 0%, transparent 70%)'
                        : i % 5 === 2
                        ? 'radial-gradient(circle, rgba(255,118,118,0.5) 0%, transparent 70%)'
                        : i % 5 === 3
                        ? 'radial-gradient(circle, rgba(194,0,0,0.5) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(205,12,54,0.6) 0%, transparent 70%)',
                      filter: 'blur(6px)',
                    }}
                  />
                ))}
              </div>
              {/* Grain overlay */}
              <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '128px 128px' }} />
              {/* Content */}
              <div className="relative z-10">
                <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-3">Tu siguiente paso</p>
                <p className="font-heading text-xl font-semibold mb-1">Agendar sesión</p>
                <p className="text-white/70 text-sm">Continúa tu transformación</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                  <span>Reservar ahora</span>
                  <ArrowRightIcon />
                </div>
              </div>
            </Link>
          )}

          {/* ③ Tu programa */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium mb-3">Tu programa</p>
            <p className="font-heading text-lg font-semibold text-kore-red mb-1">{program}</p>
            <p className="text-xs text-kore-gray-dark/50">Miembro desde {memberDate}</p>
            <div className="mt-3 pt-3 border-t border-kore-gray-light/30 flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-kore-red/60"></span>
              <span className="text-kore-gray-dark/60">Total de entrenamientos: <span className="font-semibold text-kore-gray-dark">{sessionsUsed}</span></span>
            </div>
          </div>

          {/* ④ Perfil */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
            <div className="flex items-center gap-4 mb-3">
              <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center ring-2 ring-white shadow-sm overflow-hidden">
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <span className="font-heading text-base font-semibold text-kore-red">{user.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="font-medium text-kore-gray-dark text-sm">{user.name}</p>
                <p className="text-[10px] text-kore-gray-dark/40">{user.email}</p>
              </div>
            </div>
            <div className="space-y-2 pt-3 border-t border-kore-gray-light/30 text-xs">
              <div className="flex justify-between"><span className="text-kore-gray-dark/50">Programa</span><span className="text-kore-gray-dark font-medium">{program}</span></div>
              <div className="flex justify-between"><span className="text-kore-gray-dark/50">Entrenamientos</span><span className="text-kore-gray-dark font-medium">{sessionsUsed} de {sessionsTotal}</span></div>
              <div className="flex justify-between"><span className="text-kore-gray-dark/50">Miembro desde</span><span className="text-kore-gray-dark font-medium capitalize">{memberDate}</span></div>
            </div>
          </div>

          {/* ⑤ Próximas sesiones */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-base font-semibold text-kore-gray-dark">Próximas sesiones</h2>
              <Link href="/book-session" className="text-xs text-kore-red font-medium hover:underline">Agendar nueva</Link>
            </div>
            {(() => {
              const upcoming = bookings.filter(
                (b) => b.status === 'pending' && new Date(b.slot.starts_at) > new Date()
              ).sort((a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime());
              return upcoming.length > 0 ? (
                <div className="space-y-2">
                  {upcoming.slice(0, 4).map((booking) => {
                    const d = new Date(booking.slot.starts_at);
                    const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                    const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const trainerName = booking.trainer ? `${booking.trainer.first_name} ${booking.trainer.last_name}`.trim() : '';
                    return (
                      <div key={booking.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-kore-cream/30 hover:bg-kore-cream/60 transition-colors">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-kore-red/10 flex items-center justify-center">
                          <CalendarIcon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-kore-gray-dark capitalize">{dateStr} <span className="text-kore-red">· {timeStr}</span></p>
                          <p className="text-[10px] text-kore-gray-dark/50">{booking.package?.title ?? '—'}{trainerName ? ` · ${trainerName}` : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-kore-cream mx-auto mb-2 flex items-center justify-center"><CalendarIcon /></div>
                  <p className="text-xs text-kore-gray-dark/50 mb-1">No tienes sesiones próximas</p>
                  <Link href="/book-session" className="text-xs text-kore-red font-medium hover:underline">Agenda tu siguiente sesión</Link>
                </div>
              );
            })()}
          </div>


          {/* ⑦ Evaluación Postural */}
          {posturoEvals.length > 0 && (() => {
            const latest = posturoEvals[0];
            const CTP: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', orange: 'text-orange-700', red: 'text-red-600' };
            const CBP: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', orange: 'bg-orange-100', red: 'bg-red-100' };
            const CDP: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500' };
            return (
              <Link href="/my-posturometry" className="block bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading text-base font-semibold text-kore-gray-dark">Evaluación Postural</h2>
                  <svg className="w-4 h-4 text-kore-gray-dark/30 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${CBP[latest.global_color] || CBP.green}`}>
                    <span className={`font-heading text-lg font-bold ${CTP[latest.global_color] || CTP.green}`}>{latest.global_index}</span>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${CTP[latest.global_color] || CTP.green}`}>{latest.global_category}</p>
                    <p className="text-[10px] text-kore-gray-dark/40">Índice global</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: 'Superior', val: latest.upper_index, col: latest.upper_color },
                    { label: 'Central', val: latest.central_index, col: latest.central_color },
                    { label: 'Inferior', val: latest.lower_index, col: latest.lower_color },
                  ].map((r) => (
                    <div key={r.label} className="text-center">
                      <p className={`font-heading text-sm font-bold ${CTP[r.col] || CTP.green}`}>{r.val}</p>
                      <p className="text-[10px] text-kore-gray-dark/40">{r.label}</p>
                    </div>
                  ))}
                </div>
                <div ref={posturoDotsRef} className="flex items-center gap-1.5">
                  {['upper', 'central', 'lower'].map((r) => {
                    const col = r === 'upper' ? latest.upper_color : r === 'central' ? latest.central_color : latest.lower_color;
                    return <div key={r} className={`posturo-wave-dot w-2 h-2 rounded-full ${CDP[col] || CDP.green}`} />;
                  })}
                  <span className="text-[10px] text-kore-gray-dark/40 ml-1">Ver detalle</span>
                </div>
              </Link>
            );
          })()}

          {/* ⑧ Mi estado físico (Antropometría) */}
          {anthroEvals.length > 0 && (() => {
            const latest = anthroEvals[0];
            const first = anthroEvals.length > 1 ? anthroEvals[anthroEvals.length - 1] : null;
            const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
            const CD: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', red: 'bg-red-500' };
            const weightDiff = first ? parseFloat(latest.weight_kg) - parseFloat(first.weight_kg) : null;
            const fatDiff = first ? parseFloat(latest.body_fat_pct) - parseFloat(first.body_fat_pct) : null;
            return (
              <Link href="/my-diagnosis" className="block bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-heading text-base font-semibold text-kore-gray-dark">Mi diagnóstico</h2>
                  </div>
                  <svg className="w-4 h-4 text-kore-gray-dark/30 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="font-heading text-lg font-bold text-kore-gray-dark">{latest.weight_kg}</p>
                    <p className="text-[10px] text-kore-gray-dark/40">kg</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-heading text-lg font-bold ${CT[latest.bf_color] || CT.green}`}>{latest.body_fat_pct}%</p>
                    <p className="text-[10px] text-kore-gray-dark/40">grasa</p>
                  </div>
                  <div className="text-center">
                    <p className="font-heading text-lg font-bold text-green-700">{latest.lean_mass_kg}</p>
                    <p className="text-[10px] text-kore-gray-dark/40">masa libre</p>
                  </div>
                </div>
                {first && (weightDiff !== null || fatDiff !== null) && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-kore-gray-dark/40">Desde inicio:</span>
                    {weightDiff !== null && Math.abs(weightDiff) >= 0.1 && (
                      <span className={weightDiff < 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                        {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg
                      </span>
                    )}
                    {fatDiff !== null && Math.abs(fatDiff) >= 0.1 && (
                      <span className={fatDiff < 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                        {fatDiff > 0 ? '+' : ''}{fatDiff.toFixed(1)}% grasa
                      </span>
                    )}
                  </div>
                )}
                <div ref={anthroDotsRef} className="mt-2 flex items-center gap-1.5">
                  {['bmi', 'whr', 'bf', 'waist'].map((idx) => {
                    const color = idx === 'bmi' ? latest.bmi_color : idx === 'whr' ? latest.whr_color : idx === 'bf' ? latest.bf_color : latest.waist_risk_color;
                    return <div key={idx} className={`anthro-wave-dot w-2 h-2 rounded-full ${CD[color] || CD.green}`} />;
                  })}
                  <span className="text-[10px] text-kore-gray-dark/40 ml-1">Ver detalle</span>
                </div>
              </Link>
            );
          })()}

          {/* ⑨ Evaluación Física */}
          {physicalEvals.length > 0 && (() => {
            const latest = physicalEvals[0];
            const CTP: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
            const CBP: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
            const CDP: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', red: 'bg-red-500' };
            return (
              <Link href="/my-physical-evaluation" className="block bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading text-base font-semibold text-kore-gray-dark">Evaluación Física</h2>
                  <svg className="w-4 h-4 text-kore-gray-dark/30 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${CBP[latest.general_color] || CBP.green}`}>
                    <span className={`font-heading text-lg font-bold ${CTP[latest.general_color] || CTP.green}`}>{latest.general_index}</span>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${CTP[latest.general_color] || CTP.green}`}>{latest.general_category}</p>
                    <p className="text-[10px] text-kore-gray-dark/40">Condición general</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'Fuerza', val: latest.strength_index, col: latest.strength_color },
                    { label: 'Resist.', val: latest.endurance_index, col: latest.endurance_color },
                    { label: 'Movil.', val: latest.mobility_index, col: latest.mobility_color },
                    { label: 'Equil.', val: latest.balance_index, col: latest.balance_color },
                  ].map((r) => (
                    <div key={r.label} className="text-center">
                      <p className={`font-heading text-sm font-bold ${CTP[r.col] || CTP.green}`}>{r.val ?? '—'}</p>
                      <p className="text-[10px] text-kore-gray-dark/40">{r.label}</p>
                    </div>
                  ))}
                </div>
                <div ref={physicalDotsRef} className="flex items-center gap-1.5">
                  {['strength', 'endurance', 'mobility', 'balance'].map((k) => {
                    const col = String((latest as unknown as Record<string, unknown>)[`${k}_color`] || 'green');
                    return <div key={k} className={`physical-wave-dot w-2 h-2 rounded-full ${CDP[col] || CDP.green}`} />;
                  })}
                  <span className="text-[10px] text-kore-gray-dark/40 ml-1">Ver detalle</span>
                </div>
              </Link>
            );
          })()}

          {/* ⑥ Historial reciente (compact) */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
            <h2 className="font-heading text-sm font-semibold text-kore-gray-dark mb-2">Historial reciente</h2>
            <div className="space-y-0.5">
              {bookings.filter(b => b.status === 'confirmed').length > 0 ? (
                bookings.filter(b => b.status === 'confirmed').slice(0, 3).map((booking) => {
                  const date = new Date(booking.slot.starts_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
                  return (
                    <div key={booking.id} className="flex items-center gap-2 py-1.5 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0"><p className="text-[11px] font-medium text-kore-gray-dark truncate">{booking.package?.title ?? '—'}</p></div>
                      <p className="text-[10px] text-kore-gray-dark/40 capitalize">{date}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-kore-gray-dark/40 text-center py-2">Sin sesiones completadas</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
