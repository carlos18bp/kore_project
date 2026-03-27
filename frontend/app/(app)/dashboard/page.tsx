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
import { useNutritionStore } from '@/lib/stores/nutritionStore';
import { useParqStore } from '@/lib/stores/parqStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import SubscriptionDashboardToast from '@/app/components/subscription/SubscriptionDashboardToast';
import { ExpandableIndicator, type IndicatorData } from '@/app/components/dashboard/ExpandableIndicator';
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
  const { entries: nutritionEntries, fetchMyEntries: fetchMyNutrition } = useNutritionStore();
  const { assessments: parqAssessments, fetchMyAssessments: fetchMyParq } = useParqStore();
  const { koreIndex, fetchPending: fetchPendingAssessments, loaded: pendingLoaded } = usePendingAssessmentsStore();
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
    fetchMyNutrition();
    fetchMyParq();
    fetchPendingAssessments();
  }, [fetchSubscriptions, fetchUpcomingReminder, fetchBookings, fetchMyEvaluations, fetchMyPosturoEvals, fetchMyPhysicalEvals, fetchMyNutrition, fetchMyParq, fetchPendingAssessments]);

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
        tl.to(dot, { y: -3, opacity: 0.45, duration: 0.4 }, i * 0.15)
          .to(dot, { y: 0, opacity: 1, duration: 0.4 }, i * 0.15 + 0.4);
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
        tl.to(dot, { y: -3, opacity: 0.45, duration: 0.4 }, i * 0.15)
          .to(dot, { y: 0, opacity: 1, duration: 0.4 }, i * 0.15 + 0.4);
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
        tl.to(dot, { y: -3, opacity: 0.45, duration: 0.4 }, i * 0.15)
          .to(dot, { y: 0, opacity: 1, duration: 0.4 }, i * 0.15 + 0.4);
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
    { label: 'Mi suscripción', icon: <ClipboardIcon />, href: '/subscription' },
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

      <div className="w-full px-4 sm:px-6 md:px-10 lg:px-14 pt-20 xl:pt-6 pb-12 relative z-10">

        {/* ═══ TOP HEADER: Greeting ═══ */}
        <div data-hero="badge" className="mb-6 xl:mb-8">
          <div>
            <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu espacio</p>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
              {getGreeting()}, {user.name.split(' ')[0]}
            </h1>
          </div>
        </div>


        {/* ═══════ MOBILE ONLY: PRIMARY METRICS (Large cards) ═══════ */}
        <div className="xl:hidden space-y-3 mb-3">
          {/* CTA - Agendar sesión MOBILE */}
          {formattedDate ? (
            <div className="relative rounded-2xl p-4 text-white overflow-hidden shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-kore-red via-kore-crimson to-kore-burgundy" />
              <div ref={mobileBubblesRef} className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="cta-bubble absolute rounded-full" style={{ background: i % 5 === 0 ? 'radial-gradient(circle, rgba(255,64,64,0.7) 0%, transparent 70%)' : i % 5 === 1 ? 'radial-gradient(circle, rgba(171,13,47,0.6) 0%, transparent 70%)' : i % 5 === 2 ? 'radial-gradient(circle, rgba(255,118,118,0.5) 0%, transparent 70%)' : i % 5 === 3 ? 'radial-gradient(circle, rgba(194,0,0,0.5) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(205,12,54,0.6) 0%, transparent 70%)', filter: 'blur(6px)' }} />
                ))}
              </div>
              <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '128px 128px' }} />
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon />
                </div>
                <div className="flex-1">
                  <p className="font-heading text-sm font-semibold">Próxima sesión</p>
                  <p className="text-xs text-white/70 capitalize">{formattedDate}, {formattedTime}</p>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/book-session" className="group relative block rounded-2xl p-4 text-white overflow-hidden shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-kore-red via-kore-crimson to-kore-burgundy" />
              <div ref={mobileBubblesRef} className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="cta-bubble absolute rounded-full" style={{ background: i % 5 === 0 ? 'radial-gradient(circle, rgba(255,64,64,0.7) 0%, transparent 70%)' : i % 5 === 1 ? 'radial-gradient(circle, rgba(171,13,47,0.6) 0%, transparent 70%)' : i % 5 === 2 ? 'radial-gradient(circle, rgba(255,118,118,0.5) 0%, transparent 70%)' : i % 5 === 3 ? 'radial-gradient(circle, rgba(194,0,0,0.5) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(205,12,54,0.6) 0%, transparent 70%)', filter: 'blur(6px)' }} />
                ))}
              </div>
              <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '128px 128px' }} />
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon />
                </div>
                <div className="flex-1">
                  <p className="font-heading text-sm font-semibold">Agendar sesión</p>
                  <p className="text-xs text-white/70">Continúa tu transformación</p>
                </div>
                <ArrowRightIcon />
              </div>
            </Link>
          )}

          {/* KÓRE Score + Progress — side by side compact */}
          <div className="grid grid-cols-2 gap-2">
            {/* KÓRE Score — compact with component dots */}
            {koreIndex && koreIndex.kore_score !== null ? (() => {
              const kCol = koreIndex.kore_color === 'green' ? 'emerald' : koreIndex.kore_color === 'yellow' ? 'amber' : koreIndex.kore_color === 'orange' ? 'orange' : 'red';
              const kText = `text-${kCol}-700`;
              const kBg = `bg-${kCol}-500`;
              const components = [
                { key: 'anthropometry', emoji: '💪' },
                { key: 'posturometry', emoji: '🧘' },
                { key: 'physical', emoji: '⚡' },
                { key: 'nutrition', emoji: '🥗' },
                { key: 'mood', emoji: '😊' },
              ];
              return (
                <Link href="/subscription" className="block bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/60 shadow-sm">
                  <p className="text-[9px] text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-1">Tu nivel KÓRE</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`font-heading text-2xl font-bold ${koreIndex.kore_color === 'green' ? 'text-emerald-700' : koreIndex.kore_color === 'yellow' ? 'text-amber-600' : koreIndex.kore_color === 'orange' ? 'text-orange-600' : 'text-red-600'}`}>{koreIndex.kore_score}</span>
                    <span className="text-[9px] text-kore-gray-dark/30">/100</span>
                  </div>
                  <p className={`text-[10px] font-semibold mb-2 ${koreIndex.kore_color === 'green' ? 'text-emerald-700' : koreIndex.kore_color === 'yellow' ? 'text-amber-600' : koreIndex.kore_color === 'orange' ? 'text-orange-600' : 'text-red-600'}`}>{koreIndex.kore_category}</p>
                  {/* Component dots */}
                  <div className="flex items-center gap-1">
                    {components.map(({ key, emoji }) => {
                      const val = koreIndex.components[key];
                      if (val === undefined) return null;
                      const dotCol = val >= 75 ? 'bg-emerald-500' : val >= 60 ? 'bg-amber-400' : val >= 40 ? 'bg-orange-400' : 'bg-red-500';
                      return (
                        <div key={key} className="flex flex-col items-center gap-0.5 flex-1" title={`${key}: ${Math.round(val)}`}>
                          <span className="text-[10px]">{emoji}</span>
                          <div className={`w-full h-1 rounded-full ${dotCol}`} />
                        </div>
                      );
                    })}
                  </div>
                </Link>
              );
            })() : (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/60 shadow-sm">
                <p className="text-[9px] text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-1">Tu nivel KÓRE</p>
                <p className="text-[10px] text-kore-gray-dark/40">Completa evaluaciones</p>
              </div>
            )}

            {/* Progress — compact with circle */}
            <Link href="/subscription" className="block bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/60 shadow-sm">
              <p className="text-[9px] text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-1">Progreso</p>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E5E5" strokeWidth="3.5" />
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#progressGradientMobile)" strokeWidth="3.5" strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" />
                    <defs><linearGradient id="progressGradientMobile" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#670F22" /><stop offset="100%" stopColor="#AB0D2F" /></linearGradient></defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-heading text-sm font-bold text-kore-gray-dark">{progressPercent}%</span>
                  </div>
                </div>
                <div>
                  <p className="font-heading text-sm font-bold text-kore-gray-dark">{sessionsUsed}/{sessionsTotal}</p>
                  <p className="text-[9px] text-kore-gray-dark/40">sesiones</p>
                </div>
              </div>
              {/* Mood + Goal mini */}
              <div className="space-y-1 pt-1.5 border-t border-kore-gray-light/20">
                {todayMood ? (
                  <div className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${todayMood.score >= 7 ? 'bg-green-100 text-green-700' : todayMood.score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{todayMood.score}</div>
                    <span className="text-[9px] text-kore-gray-dark/50">Estado hoy</span>
                  </div>
                ) : (
                  <Link href="/profile" className="text-[9px] text-kore-red font-medium">Registrar estado</Link>
                )}
                {(() => {
                  const goalValue = profile?.customer_profile?.primary_goal;
                  return goalValue ? (
                    <p className="text-[9px] text-kore-gray-dark/50 truncate">🎯 {getGoalLabel(goalValue)}</p>
                  ) : null;
                })()}
              </div>
            </Link>
          </div>

          {/* Próximas sesiones — moved after diagnostics, see below */}
        </div>

        {/* ═══════ DESKTOP: Progress + CTA + KÓRE Score ═══════ */}
        <div data-hero="body" className="hidden xl:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 xl:gap-4 mb-3 xl:mb-4">

          {/* ① Progress + Goal + Mood + Motivation — left column */}
          <div className="xl:col-span-3 xl:row-span-2 bg-white/70 backdrop-blur-sm rounded-2xl p-3 md:p-5 border border-white/60 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <p className="text-[10px] md:text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium">Tu progreso</p>
              <span className="text-[10px] md:text-xs text-green-700 font-semibold bg-green-100 px-1.5 md:px-2 py-0.5 rounded-full">
                {getProgressStage(progressPercent)}
              </span>
            </div>
            <div className="flex items-center gap-2 md:gap-4 mb-2 md:mb-4">
              <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
                <svg className="w-12 h-12 md:w-16 md:h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E5E5" strokeWidth="3" />
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#progressGradient)" strokeWidth="3" strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" />
                  <defs><linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#670F22" /><stop offset="100%" stopColor="#AB0D2F" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-heading text-sm md:text-lg font-bold text-kore-gray-dark">{progressPercent}%</span>
                </div>
              </div>
              <div>
                <p className="font-heading text-sm md:text-base font-semibold text-kore-gray-dark">{sessionsUsed} sesiones</p>
                <p className="text-[10px] md:text-xs text-kore-gray-dark/50">completadas de {sessionsTotal}</p>
              </div>
            </div>
            {/* Mi objetivo (inline) */}
            {(() => {
              const goalValue = profile?.customer_profile?.primary_goal;
              const GoalIcon = goalValue ? getGoalIcon(goalValue) : null;
              return (
                <div className="py-2 md:py-3 border-t border-kore-gray-light/30">
                  {goalValue && GoalIcon ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                        <GoalIcon className="w-3 h-3 md:w-4 md:h-4 text-kore-red" />
                      </div>
                      <div>
                        <p className="text-[10px] md:text-xs text-kore-gray-dark/40 uppercase tracking-wider mb-0.5">Mi objetivo</p>
                        <span className="text-xs md:text-sm font-medium text-kore-gray-dark">{getGoalLabel(goalValue)}</span>
                      </div>
                    </div>
                  ) : (
                    <Link href="/profile" className="text-[10px] md:text-xs text-kore-red hover:underline">Define tu objetivo</Link>
                  )}
                </div>
              );
            })()}
            {/* Estado de hoy (embedded) */}
            <div className="py-2 md:py-3 border-t border-kore-gray-light/30">
              {todayMood ? (
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-heading text-xs md:text-sm font-bold flex-shrink-0 ${
                      todayMood.score >= 7 ? 'bg-green-100 text-green-700' : todayMood.score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                    }`}>{todayMood.score}</div>
                    <div>
                      <p className="text-[10px] md:text-xs text-kore-gray-dark/40 uppercase tracking-wider mb-0.5">Estado de hoy</p>
                      <p className={`text-xs md:text-sm font-medium ${todayMood.score >= 7 ? 'text-green-700' : todayMood.score >= 4 ? 'text-amber-700' : 'text-red-600'}`}>
                        {todayMood.score >= 9 ? 'Excelente' : todayMood.score >= 7 ? 'Bien' : todayMood.score >= 5 ? 'Regular' : todayMood.score >= 3 ? 'Bajo' : 'Muy bajo'}
                        <span className="text-kore-gray-dark/40 text-[10px] md:text-xs font-normal ml-1">de 10</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-kore-gray-dark/45 leading-relaxed mt-1 md:mt-1.5 ml-8 md:ml-10 hidden md:block">
                    {todayMood.score >= 7
                      ? 'Tu bienestar hoy es favorable. Buena disposición para entrenar.'
                      : todayMood.score >= 4
                      ? 'Tu bienestar hoy es regular. Escucha a tu cuerpo y coméntalo con tu entrenador si es frecuente.'
                      : 'Tu bienestar hoy está bajo. Si te sientes así con frecuencia, coméntalo con tu entrenador.'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-kore-cream flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 md:w-4 md:h-4 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-kore-gray-dark/40 uppercase tracking-wider mb-0.5">Estado de hoy</p>
                    <Link href="/profile" className="text-[10px] md:text-xs text-kore-red font-medium hover:underline">Registra cómo te sientes</Link>
                  </div>
                </div>
              )}
            </div>
            {/* Tu motivación - Desktop only */}
            <div className="hidden xl:flex items-start gap-2.5 mt-auto pt-3 border-t border-kore-gray-light/30">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs text-purple-600/80 uppercase tracking-wider font-semibold mb-0.5">Tu motivación</p>
                <p className="text-xs text-kore-gray-dark/70 leading-relaxed">{getProgressMessage(sessionsUsed, progressPercent)}</p>
              </div>
            </div>
            {/* Miembro desde - Desktop only */}
            <div className="hidden xl:block pt-3 border-t border-kore-gray-light/30">
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider mb-0.5">Miembro desde</p>
              <p className="text-sm font-medium text-kore-gray-dark capitalize">{memberDate}</p>
            </div>
          </div>

          {/* ② CTA + Próximas sesiones — center column */}
          <div className="xl:col-span-5 flex flex-col gap-3 xl:gap-4">
            {formattedDate ? (
              <div className="relative rounded-2xl p-5 text-white overflow-hidden flex-1">
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
                  <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-2">Próxima sesión</p>
                  <p className="font-heading text-xl font-semibold capitalize mb-0.5">{formattedDate}</p>
                  <p className="text-white/80 text-base mb-2">{formattedTime}</p>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <CalendarIcon />
                    <span>{upcomingReminder?.trainer ? `${upcomingReminder.trainer.first_name} ${upcomingReminder.trainer.last_name}`.trim() : program}</span>
                  </div>
                </div>
              </div>
            ) : (
              <Link href="/book-session" className="group relative block rounded-2xl p-5 text-white overflow-hidden hover:shadow-lg transition-shadow flex-1">
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
                  <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-2">Tu siguiente paso</p>
                  <p className="font-heading text-xl font-semibold mb-0.5">Agendar sesión</p>
                  <p className="text-white/80 text-base">Continúa tu transformación</p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                    <span>Reservar ahora</span>
                    <ArrowRightIcon />
                  </div>
                </div>
              </Link>
            )}

            {/* ⑤ Próximas sesiones — stacked under CTA */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-sm font-semibold text-kore-gray-dark">Próximas sesiones</h2>
                <Link href="/book-session" className="text-[10px] text-kore-red font-medium hover:underline">Agendar nueva</Link>
              </div>
              {(() => {
                const upcoming = bookings.filter(
                  (b) => b.status === 'pending' && new Date(b.slot.starts_at) > new Date()
                ).sort((a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime());
                return upcoming.length > 0 ? (
                  <div className="space-y-1.5">
                    {upcoming.slice(0, 3).map((booking) => {
                      const d = new Date(booking.slot.starts_at);
                      const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                      const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                      const trainerName = booking.trainer ? `${booking.trainer.first_name} ${booking.trainer.last_name}`.trim() : '';
                      return (
                        <div key={booking.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-kore-cream/30 hover:bg-kore-cream/60 transition-colors">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-kore-red/10 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-kore-gray-dark capitalize">{dateStr} <span className="text-kore-red">· {timeStr}</span></p>
                            <p className="text-xs text-kore-gray-dark/50">{booking.package?.title ?? '—'}{trainerName ? ` · ${trainerName}` : ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-10 h-10 rounded-full bg-kore-cream mx-auto mb-1.5 flex items-center justify-center"><CalendarIcon /></div>
                    <p className="text-sm text-kore-gray-dark/50 mb-1">No tienes sesiones próximas</p>
                    <Link href="/book-session" className="text-xs text-kore-red font-medium hover:underline">Agenda tu siguiente sesión</Link>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ③ Calificación KÓRE — right column */}
          <div className="xl:col-span-4 xl:row-span-2 bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm flex flex-col">
            {koreIndex && koreIndex.kore_score !== null ? (() => {
              const score = koreIndex.kore_score;
              const CK: Record<string, string> = { green: 'text-emerald-700', yellow: 'text-amber-600', orange: 'text-orange-600', red: 'text-red-600' };
              const pct = Math.min(score / 100, 1) * 100;
              const col = koreIndex.kore_color;
              return (
                <div className="flex flex-col h-full">
                  <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Calificación KÓRE</p>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E5E5" strokeWidth="3" />
                        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={col === 'green' ? '#10b981' : col === 'yellow' ? '#f59e0b' : col === 'orange' ? '#f97316' : '#ef4444'} strokeWidth="3" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`font-heading text-lg font-bold ${CK[col] || CK.green}`}>{score}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${CK[col] || CK.green}`}>{koreIndex.kore_category}</p>
                      <p className="text-xs text-kore-gray-dark/40 leading-relaxed mt-0.5">{koreIndex.kore_message}</p>
                    </div>
                  </div>
                  {/* Module breakdown mini bars */}
                  <div className="space-y-2 flex-1">
                    {[
                      { key: 'anthropometry', label: 'Composición' },
                      { key: 'metabolic_risk', label: 'Riesgo metab.' },
                      { key: 'posturometry', label: 'Postura' },
                      { key: 'physical', label: 'Condición' },
                      { key: 'mood', label: 'Bienestar' },
                      { key: 'nutrition', label: 'Nutrición' },
                    ].map(({ key, label }) => {
                      const val = koreIndex.components[key];
                      if (val === undefined) return null;
                      const barCol = val >= 75 ? 'bg-emerald-500' : val >= 60 ? 'bg-amber-400' : val >= 40 ? 'bg-orange-400' : 'bg-red-500';
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-kore-gray-dark/50 w-20 truncate">{label}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full">
                            <div className={`h-2 rounded-full transition-all duration-500 ${barCol}`} style={{ width: `${Math.min(val, 100)}%` }} />
                          </div>
                          <span className="text-xs text-kore-gray-dark/60 font-semibold w-7 text-right">{Math.round(val)}</span>
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                  <p className="text-xs text-kore-gray-dark/30 mt-3">{koreIndex.modules_available} de {koreIndex.modules_total} módulos evaluados</p>
                  {/* What sustains / what to improve */}
                  {(() => {
                    const MODULE_LABELS: Record<string, string> = { anthropometry: 'Composición', metabolic_risk: 'Riesgo metab.', posturometry: 'Postura', physical: 'Cond. física', mood: 'Bienestar', nutrition: 'Nutrición' };
                    const entries = Object.entries(koreIndex.components).filter(([, v]) => v !== undefined) as [string, number][];
                    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
                    const best = sorted.filter(([, v]) => v >= 75).slice(0, 2);
                    const worst = sorted.filter(([, v]) => v < 60).reverse().slice(0, 2);
                    if (best.length === 0 && worst.length === 0) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-kore-gray-light/20 space-y-2">
                        {best.length > 0 && (
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-kore-gray-dark/60"><span className="font-medium text-emerald-700">Te sostiene:</span> {best.map(([k]) => MODULE_LABELS[k] || k).join(', ')}</p>
                          </div>
                        )}
                        {worst.length > 0 && (
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-kore-gray-dark/60"><span className="font-medium text-amber-700">Puedes mejorar:</span> {worst.map(([k]) => MODULE_LABELS[k] || k).join(', ')}</p>
                          </div>
                        )}
                        <p className="text-xs text-kore-gray-dark/35 leading-relaxed">Tu entrenador usará esta lectura para orientar tu siguiente fase.</p>
                      </div>
                    );
                  })()}
                </div>
              );
            })() : (
              <div>
                <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-2">Calificación KÓRE</p>
                <p className="text-sm text-kore-gray-dark/40">Completa tus evaluaciones para ver tu calificación general.</p>
              </div>
            )}
          </div>
        </div>


        {/* ═══════ DIAGNOSTIC MODULES SECTION ═══════ */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3 xl:gap-4 mb-3 xl:mb-4">

          {/* ⑦ Evaluación Postural — with progress bars */}
          {posturoEvals.length > 0 && (() => {
            const latest = posturoEvals[0];
            const first = posturoEvals.length > 1 ? posturoEvals[posturoEvals.length - 1] : null;
            const CTP: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', orange: 'text-orange-700', red: 'text-red-600' };
            const CBP: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', orange: 'bg-orange-100', red: 'bg-red-100' };
            const FILL_P: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500' };
            const zones = [
              { key: 'global', label: 'General', idx: latest.global_index, cat: latest.global_category, col: latest.global_color, firstIdx: first?.global_index },
              { key: 'upper', label: 'Superior', idx: latest.upper_index, cat: latest.upper_category, col: latest.upper_color, firstIdx: first?.upper_index },
              { key: 'central', label: 'Central', idx: latest.central_index, cat: latest.central_category, col: latest.central_color, firstIdx: first?.central_index },
              { key: 'lower', label: 'Inferior', idx: latest.lower_index, cat: latest.lower_category, col: latest.lower_color, firstIdx: first?.lower_index },
            ];
            const globalDiff = first ? parseFloat(latest.global_index) - parseFloat(first.global_index) : null;
            const posturoIndicators: IndicatorData[] = [
              { key: 'upper', label: 'Zona superior', value: latest.upper_index, category: latest.upper_category || 'Funcional', color: latest.upper_color,
                whatIs: 'Incluye cabeza, cuello, hombros, escápulas y codos. Los desbalances suelen venir de hábitos posturales.',
                meaning: latest.upper_color === 'green' ? 'Tu zona superior muestra alineación funcional.' : latest.upper_color === 'yellow' ? 'Se observan desbalances leves, posiblemente por hábitos posturales.' : 'Se detectan desbalances que pueden afectar tu movilidad.',
                importance: 'La zona superior influye en cómo usas los brazos, hombros y cuello en tu día a día y en el entrenamiento.',
                nextStep: 'Tu entrenador incorporará ejercicios de movilidad y fortalecimiento adaptados a esta zona.' },
              { key: 'central', label: 'Zona central', value: latest.central_index, category: latest.central_category || 'Funcional', color: latest.central_color,
                whatIs: 'Incluye columna vertebral, abdomen, cadera y pelvis. Es el centro de control de tu cuerpo.',
                meaning: latest.central_color === 'green' ? 'Tu zona central muestra buena alineación.' : latest.central_color === 'yellow' ? 'Se observan desbalances leves que pueden influir en cómo distribuyes la carga.' : 'Hay desbalances que pueden afectar tu estabilidad y función.',
                importance: 'El centro de tu cuerpo es donde nace la fuerza funcional. Un centro equilibrado mejora todo tu movimiento.',
                nextStep: 'Tu entrenador incluirá trabajo de core y movilidad de columna en tu programa.' },
              { key: 'lower', label: 'Zona inferior', value: latest.lower_index, category: latest.lower_category || 'Funcional', color: latest.lower_color,
                whatIs: 'Incluye rodillas, pies y zona poplítea. Es la base de apoyo de tu cuerpo.',
                meaning: latest.lower_color === 'green' ? 'Tu tren inferior muestra buena alineación.' : latest.lower_color === 'yellow' ? 'Se observan desbalances leves que pueden influir en cómo absorbes el impacto.' : 'Hay desbalances que pueden afectar tu mecánica de movimiento.',
                importance: 'Tus piernas y pies son la base de apoyo de tu cuerpo. Un buen apoyo protege articulaciones.',
                nextStep: 'Tu entrenador incorporará ejercicios de estabilización y movilidad de tren inferior.' },
            ];
            return (
              <Link href="/my-posturometry" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                <div className="flex items-center justify-between mb-1.5 md:mb-2.5">
                  <h2 className={`font-heading text-xs md:text-base font-semibold ${CTP[latest.global_color] || CTP.green}`}>{latest.global_category || 'Postura'}</h2>
                  <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                {/* Global score + scale explanation */}
                <div className="flex items-center gap-2 md:gap-2.5">
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center ${CBP[latest.global_color] || CBP.green}`}>
                    <span className={`font-heading text-lg md:text-xl font-bold ${CTP[latest.global_color] || CTP.green}`}>{latest.global_index}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] md:text-xs text-kore-gray-dark/50 leading-snug">Escala 0–3 · más cerca de 0 es mejor</p>
                    {globalDiff !== null && Math.abs(globalDiff) >= 0.05 && (
                      <p className={`text-[9px] md:text-[10px] font-semibold mt-0.5 ${globalDiff < 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {globalDiff < 0 ? 'Mejoró' : 'Subió'} {Math.abs(globalDiff).toFixed(2)} desde inicio
                      </p>
                    )}
                  </div>
                </div>
                {/* Zone progress bars — both mobile & desktop */}
                <div className="mt-2 space-y-1.5">
                  {zones.map((z) => {
                    const val = parseFloat(z.idx);
                    const pct = Math.min((val / 3) * 100, 100);
                    const col = z.col || 'green';
                    const initVal = z.firstIdx ? parseFloat(z.firstIdx) : null;
                    const diff = initVal != null ? val - initVal : null;
                    const improved = diff != null && Math.abs(diff) >= 0.05 ? diff < 0 : null;
                    return (
                      <div key={z.key}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] md:text-xs text-kore-gray-dark/60 font-medium">{z.label}</span>
                          <span className={`text-[10px] md:text-xs font-bold ${CTP[col] || CTP.green}`}>{z.idx}</span>
                        </div>
                        <div className={`h-1.5 md:h-2 rounded-full ${CBP[col] || CBP.green} overflow-hidden`}>
                          <div className={`h-full rounded-full ${FILL_P[col] || FILL_P.green} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop only - expandable indicators */}
                <div className="hidden md:block">
                  <p className="text-xs text-kore-gray-dark/35 mb-1.5 mt-2.5">Toca cada zona para ver qué significa</p>
                  <div className="pt-2.5 border-t border-kore-gray-light/20 space-y-0.5">
                    {posturoIndicators.map((ind) => (
                      <ExpandableIndicator key={ind.key} ind={ind} />
                    ))}
                  </div>
                  {latest.notes && (
                    <div className="pt-2 border-t border-kore-gray-light/20 mt-2">
                      <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider font-medium mb-0.5">Tu entrenador</p>
                      <p className="text-xs text-kore-gray-dark/60 leading-relaxed line-clamp-2 italic">{latest.notes}</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })()}

          {/* ⑧ Mi estado físico (Antropometría) — mobile simplified */}
          {anthroEvals.length > 0 && (() => {
            const latest = anthroEvals[0];
            const first = anthroEvals.length > 1 ? anthroEvals[anthroEvals.length - 1] : null;
            const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
            const weightDiff = first ? parseFloat(latest.weight_kg) - parseFloat(first.weight_kg) : null;
            const fatDiff = first ? parseFloat(latest.body_fat_pct) - parseFloat(first.body_fat_pct) : null;
            const anthroIndicators: IndicatorData[] = [
              { key: 'bf', label: 'Composición corporal', value: latest.body_fat_pct, unit: '%', category: latest.bf_category, color: latest.bf_color,
                whatIs: 'El porcentaje de grasa indica qué parte de tu peso total es grasa corporal. Es más informativo que el peso solo.',
                meaning: latest.bf_color === 'green' ? 'Tu porcentaje de grasa está en un rango saludable. Buena composición corporal.' : latest.bf_color === 'yellow' ? 'Tu grasa corporal está un poco por encima del rango ideal. Con constancia puedes mejorar.' : 'Tu porcentaje de grasa está elevado. Cada sesión contribuye a mejorar tu composición.',
                importance: 'Este es uno de los indicadores más valiosos de tu proceso. Ayuda a ver si estás mejorando la proporción entre grasa y músculo.',
                nextStep: 'Tu entrenador ajustará la intensidad y tipo de ejercicio para optimizar tu composición corporal.',
                formula: '%Grasa = (1.20 × IMC) + (0.23 × edad) − (10.8 × sexo) − 5.4' },
              { key: 'bmi', label: 'IMC – Peso y estatura', value: latest.bmi, category: latest.bmi_category, color: latest.bmi_color,
                whatIs: 'El IMC compara tu peso con tu estatura. Es un primer filtro general — no distingue entre músculo y grasa.',
                meaning: latest.bmi_color === 'green' ? 'Tu peso está dentro del rango saludable.' : latest.bmi_color === 'yellow' ? 'Tu peso está ligeramente por encima del rango ideal. Se complementa con otros indicadores.' : 'Tu peso está en un rango que requiere atención. Tu entrenador lo analiza junto con otros datos.',
                importance: 'Este dato ayuda a entender tu estado general de peso, pero no es el único indicador importante.',
                nextStep: 'Tu entrenador tendrá este resultado en cuenta junto con tus otros indicadores para ajustar tu proceso.',
                formula: 'IMC = peso (kg) / estatura (m)²' },
              ...(latest.waist_cm ? [{ key: 'waist', label: 'Zona abdominal – Cintura', value: latest.waist_cm, unit: ' cm', category: latest.waist_risk || '—', color: latest.waist_risk_color,
                whatIs: 'El perímetro de cintura es uno de los indicadores más directos de riesgo metabólico.',
                meaning: latest.waist_risk_color === 'green' ? 'Tu cintura está en un rango seguro.' : latest.waist_risk_color === 'yellow' ? 'Tu cintura está en una zona de atención. Reducir unos centímetros mejoraría tu perfil de salud.' : 'Tu cintura indica acumulación de grasa abdominal. Es de las primeras en responder al ejercicio.',
                importance: 'La cintura tiene relación directa con la grasa que rodea tus órganos internos.',
                nextStep: 'Tu entrenador incluirá estrategias para reducir la cintura de forma progresiva.',
                formula: 'Perímetro de cintura (cm) comparado con umbrales OMS' } as IndicatorData] : []),
              ...(latest.waist_hip_ratio ? [{ key: 'whr', label: 'Distribución de grasa – ICC', value: latest.waist_hip_ratio, category: latest.whr_risk || '—', color: latest.whr_color,
                whatIs: 'La relación cintura-cadera mide cómo se distribuye la grasa en tu cuerpo.',
                meaning: latest.whr_color === 'green' ? 'Tu grasa se distribuye de forma saludable.' : latest.whr_color === 'yellow' ? 'Hay acumulación moderada de grasa abdominal.' : 'La distribución indica concentración abdominal significativa.',
                importance: 'La distribución de grasa es tan importante como la cantidad. Afecta tu riesgo cardiovascular.',
                nextStep: 'Tu entrenador incorporará ejercicios que ayuden a mejorar la distribución de grasa.',
                formula: 'ICC = cintura / cadera' } as IndicatorData] : []),
            ];
            return (
              <Link href="/my-diagnosis" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                <div className="flex items-center justify-between mb-1.5 md:mb-2.5">
                  <h2 className="font-heading text-xs md:text-base font-semibold text-kore-gray-dark">Diagnóstico</h2>
                  <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                {/* Mobile - simplified stats */}
                <div className="md:hidden space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-11 h-11 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-heading text-base font-bold text-kore-gray-dark">{latest.weight_kg}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-kore-gray-dark/40">Peso actual</p>
                      <p className={`text-sm font-semibold ${CT[latest.bf_color] || CT.green}`}>{latest.body_fat_pct}% grasa</p>
                    </div>
                  </div>
                  {/* Mobile: mini composition bar */}
                  {(() => {
                    const fat = parseFloat(latest.fat_mass_kg);
                    const lean = parseFloat(latest.lean_mass_kg);
                    const total = fat + lean;
                    if (total === 0) return null;
                    const fatPct = (fat / total) * 100;
                    const leanPct = (lean / total) * 100;
                    return (
                      <div className="pt-1.5">
                        <div className="flex h-2.5 rounded-full overflow-hidden">
                          <div className="bg-red-400" style={{ width: `${fatPct}%` }} />
                          <div className="bg-green-500" style={{ width: `${leanPct}%` }} />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[8px] text-kore-gray-dark/60 font-medium">{fat.toFixed(1)} kg grasa</span>
                          <span className="text-[8px] text-kore-gray-dark/60 font-medium">{lean.toFixed(1)} kg músculo</span>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Mobile: progress from start */}
                  {first && (weightDiff !== null || fatDiff !== null) && (
                    <div className="flex items-center gap-1.5 pt-0.5 text-[9px]">
                      <span className="text-kore-gray-dark/50">Desde inicio:</span>
                      {weightDiff !== null && Math.abs(weightDiff) >= 0.1 && (
                        <span className={`font-semibold ${weightDiff < 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg
                        </span>
                      )}
                      {fatDiff !== null && Math.abs(fatDiff) >= 0.1 && (
                        <span className={`font-semibold ${fatDiff < 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fatDiff > 0 ? '+' : ''}{fatDiff.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                  {/* Mobile: masa muscular + IMC mini metrics */}
                  <div className="flex items-center gap-2 pt-1.5">
                    <div className="flex-1 bg-green-50 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[9px] text-green-700/60">Músculo</p>
                      <p className="text-xs font-bold text-green-700">{latest.lean_mass_kg} <span className="font-normal">kg</span></p>
                    </div>
                    <div className={`flex-1 rounded-lg px-2 py-1.5 text-center ${latest.bmi_color === 'green' ? 'bg-green-50' : latest.bmi_color === 'yellow' ? 'bg-amber-50' : 'bg-red-50'}`}>
                      <p className={`text-[9px] ${latest.bmi_color === 'green' ? 'text-green-700/60' : latest.bmi_color === 'yellow' ? 'text-amber-700/60' : 'text-red-600/60'}`}>IMC</p>
                      <p className={`text-xs font-bold ${latest.bmi_color === 'green' ? 'text-green-700' : latest.bmi_color === 'yellow' ? 'text-amber-700' : 'text-red-600'}`}>{latest.bmi}</p>
                    </div>
                  </div>
                </div>
                {/* Desktop - full stats grid */}
                <div className="hidden md:grid grid-cols-3 gap-1.5 mb-2.5">
                  {[
                    { label: 'kg', val: latest.weight_kg, colClass: 'text-kore-gray-dark' },
                    { label: 'grasa', val: `${latest.body_fat_pct}%`, colClass: CT[latest.bf_color] || CT.green },
                    { label: 'masa libre', val: latest.lean_mass_kg, colClass: 'text-green-700' },
                  ].map((item) => (
                    <div key={item.label} className="text-center bg-kore-cream/40 rounded-lg py-1.5">
                      <p className={`font-heading text-base font-bold ${item.colClass}`}>{item.val}</p>
                      <p className="text-xs text-kore-gray-dark/40">{item.label}</p>
                    </div>
                  ))}
                </div>
                {/* Desktop only - composition bar + diff and indicators */}
                <div className="hidden md:block">
                  {/* Desktop: mini composition bar */}
                  {(() => {
                    const fat = parseFloat(latest.fat_mass_kg);
                    const lean = parseFloat(latest.lean_mass_kg);
                    const total = fat + lean;
                    if (total === 0) return null;
                    const fatPct = (fat / total) * 100;
                    const leanPct = (lean / total) * 100;
                    return (
                      <div className="mb-2">
                        <div className="flex h-3 rounded-full overflow-hidden">
                          <div className="bg-red-400 flex items-center justify-center" style={{ width: `${fatPct}%` }}>
                            {fatPct > 15 && <span className="text-[8px] text-white font-bold">{fatPct.toFixed(0)}%</span>}
                          </div>
                          <div className="bg-green-500 flex items-center justify-center" style={{ width: `${leanPct}%` }}>
                            {leanPct > 15 && <span className="text-[8px] text-white font-bold">{leanPct.toFixed(0)}%</span>}
                          </div>
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[9px] text-kore-gray-dark/60 font-medium">Grasa {fat.toFixed(1)} kg</span>
                          <span className="text-[9px] text-kore-gray-dark/60 font-medium">Músculo {lean.toFixed(1)} kg</span>
                        </div>
                      </div>
                    );
                  })()}
                  {first && (weightDiff !== null || fatDiff !== null) && (
                    <div className="flex items-center gap-2 text-xs mb-1.5">
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
                  <p className="text-xs text-kore-gray-dark/35 mb-1.5">Toca cada indicador para ver qué significa</p>
                  <div className="pt-2.5 border-t border-kore-gray-light/20 space-y-0.5">
                    {anthroIndicators.map((ind) => (
                      <ExpandableIndicator key={ind.key} ind={ind} />
                    ))}
                  </div>
                  {latest.notes && (
                    <div className="pt-2 border-t border-kore-gray-light/20 mt-2">
                      <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider font-medium mb-0.5">Tu entrenador</p>
                      <p className="text-xs text-kore-gray-dark/60 leading-relaxed line-clamp-2 italic">{latest.notes}</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })()}

          {/* ⑨ Evaluación Física — mobile simplified */}
          {physicalEvals.length > 0 && (() => {
            const latest = physicalEvals[0];
            const CTP: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
            const CBP: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
            const physIndicators: IndicatorData[] = [
              { key: 'strength', label: 'Fuerza', value: latest.strength_index ?? '—', category: latest.strength_category || '—', color: latest.strength_color,
                whatIs: 'Evalúa la capacidad de tus músculos para sostener esfuerzos repetidos: sentadillas, flexiones y plancha.',
                meaning: latest.strength_color === 'green' ? 'Tu fuerza-resistencia es funcional. Puedes sostener esfuerzos con buen control.' : latest.strength_color === 'yellow' ? 'Tu fuerza está por debajo del promedio. Hay espacio para mejorar.' : 'Tu fuerza necesita desarrollo prioritario.',
                importance: 'La fuerza es fundamental para proteger articulaciones, mejorar postura y mantener masa muscular.',
                nextStep: 'Tu entrenador adaptará los ejercicios de fuerza a tu nivel actual.' },
              { key: 'endurance', label: 'Resistencia', value: latest.endurance_index ?? '—', category: latest.endurance_category || '—', color: latest.endurance_color,
                whatIs: 'Mide tu capacidad aeróbica funcional — qué tan bien toleras un esfuerzo sostenido.',
                meaning: latest.endurance_color === 'green' ? 'Tu capacidad aeróbica es buena.' : latest.endurance_color === 'yellow' ? 'Tu capacidad aeróbica está por debajo del rango esperado.' : 'Tu resistencia necesita mejora significativa.',
                importance: 'Tu resistencia afecta cuánto puedes rendir en cada sesión de entrenamiento.',
                nextStep: 'Tu entrenador incorporará actividad cardiovascular adaptada a tu capacidad.' },
              { key: 'mobility', label: 'Movilidad', value: latest.mobility_index ?? '—', category: latest.mobility_category || '—', color: latest.mobility_color,
                whatIs: 'Evalúa los rangos de movimiento de cadera, hombros y tobillo.',
                meaning: latest.mobility_color === 'green' ? 'Tu movilidad articular es funcional.' : latest.mobility_color === 'yellow' ? 'Algunas zonas articulares tienen limitaciones leves.' : 'Hay limitaciones de movilidad que pueden afectar tu movimiento.',
                importance: 'Sin movilidad adecuada, no es seguro progresar en carga. Protege tus articulaciones.',
                nextStep: 'Tu entrenador incluirá ejercicios específicos de movilidad para las zonas que lo necesiten.' },
              { key: 'balance', label: 'Equilibrio', value: latest.balance_index ?? '—', category: latest.balance_category || '—', color: latest.balance_color,
                whatIs: 'Mide tu control neuromuscular y estabilidad sobre un solo pie.',
                meaning: latest.balance_color === 'green' ? 'Tu equilibrio y control son adecuados.' : latest.balance_color === 'yellow' ? 'Tu equilibrio está por debajo del promedio.' : 'Tu equilibrio necesita atención prioritaria.',
                importance: 'El equilibrio protege contra caídas y refleja la calidad de tu control corporal.',
                nextStep: 'Tu entrenador incorporará trabajo de estabilidad adaptado a tu nivel.' },
            ];
            return (
              <Link href="/my-physical-evaluation" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                <div className="flex items-center justify-between mb-1.5 md:mb-2.5">
                  <h2 className="font-heading text-xs md:text-base font-semibold text-kore-gray-dark">Condición física</h2>
                  <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 md:gap-2.5">
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center ${CBP[latest.general_color] || CBP.green}`}>
                    <span className={`font-heading text-lg md:text-xl font-bold ${CTP[latest.general_color] || CTP.green}`}>{latest.general_index}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm md:text-base font-semibold ${CTP[latest.general_color] || CTP.green} line-clamp-1`}>{latest.general_category}</p>
                    <p className="text-[10px] md:text-xs text-kore-gray-dark/40">Índice general</p>
                  </div>
                </div>
                {/* Mobile mini indicators */}
                <div className="grid grid-cols-2 gap-x-1 gap-y-1 mt-2 md:hidden">
                  {physIndicators.map((ind) => {
                    const dotColor = ind.color === 'green' ? 'bg-green-500' : ind.color === 'yellow' ? 'bg-amber-400' : 'bg-red-500';
                    return (
                      <div key={ind.key} className="flex items-center gap-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span className="text-[9px] text-kore-gray-dark/40 truncate">{ind.label}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop only - expandable indicators */}
                <div className="hidden md:block">
                  <p className="text-xs text-kore-gray-dark/35 mb-1.5 mt-2.5">Toca cada componente para ver qué significa</p>
                  <div className="pt-2.5 border-t border-kore-gray-light/20 space-y-0.5">
                    {physIndicators.map((ind) => (
                      <ExpandableIndicator key={ind.key} ind={ind} />
                    ))}
                  </div>
                  {latest.notes && (
                    <div className="pt-2 border-t border-kore-gray-light/20 mt-2">
                      <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider font-medium mb-0.5">Tu entrenador</p>
                      <p className="text-xs text-kore-gray-dark/60 leading-relaxed line-clamp-2 italic">{latest.notes}</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })()}

          {/* ⑩ Nutrición + ⑪ PAR-Q + ⑥ Historial — stacked in one column */}
          <div className="col-span-1 grid grid-cols-1 gap-2 md:gap-3 xl:gap-4">
            {/* Mi Nutrición */}
            {nutritionEntries.length > 0 && (() => {
              const latest = nutritionEntries[0];
              const score = latest.habit_score ? parseFloat(latest.habit_score) : 0;
              const CTN: Record<string, string> = { green: 'text-emerald-700', yellow: 'text-amber-700', red: 'text-red-600' };
              const CBN: Record<string, string> = { green: 'bg-emerald-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
              const pct = Math.min(score / 10, 1) * 100;
              const CDN: Record<string, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-red-500' };
              return (
                <Link href="/my-nutrition" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <h2 className="font-heading text-xs md:text-base font-semibold text-kore-gray-dark">Mi Nutrición</h2>
                    <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/30 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2.5 mb-1.5 md:mb-2">
                    <div className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center ${CBN[latest.habit_color] || CBN.green}`}>
                      <span className={`font-heading text-xs md:text-sm font-bold ${CTN[latest.habit_color] || CTN.green}`}>{score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] md:text-xs font-medium ${CTN[latest.habit_color] || CTN.green}`}>{latest.habit_category}</p>
                      <p className="text-[9px] md:text-xs text-kore-gray-dark/40">Índice /10</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1 md:h-1.5">
                    <div className={`h-1 md:h-1.5 rounded-full transition-all duration-500 ${CDN[latest.habit_color] || CDN.green}`} style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })()}

            {/* PAR-Q */}
            {parqAssessments.length > 0 && (() => {
              const latest = parqAssessments[0];
              const CTQ: Record<string, string> = { green: 'text-emerald-700', yellow: 'text-amber-700', red: 'text-red-600' };
              const CBQ: Record<string, string> = { green: 'bg-emerald-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
              return (
                <Link href="/my-parq" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <h2 className="font-heading text-xs md:text-base font-semibold text-kore-gray-dark">PAR-Q+</h2>
                    <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/30 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2.5">
                    <div className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center ${CBQ[latest.risk_color] || CBQ.green}`}>
                      {latest.risk_color === 'green' ? (
                        <svg className={`w-4 h-4 md:w-5 md:h-5 ${CTQ.green}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : latest.risk_color === 'yellow' ? (
                        <svg className={`w-4 h-4 md:w-5 md:h-5 ${CTQ.yellow}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      ) : (
                        <svg className={`w-4 h-4 md:w-5 md:h-5 ${CTQ.red}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-[10px] md:text-xs font-medium ${CTQ[latest.risk_color] || CTQ.green}`}>{latest.risk_label}</p>
                      <p className="text-[9px] md:text-xs text-kore-gray-dark/40">{latest.yes_count}/7 respuestas afirmativas</p>
                    </div>
                  </div>
                </Link>
              );
            })()}

            {/* ⑥ Historial reciente */}
            <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-3.5 border border-white/60 shadow-sm hidden xl:block">
              <h2 className="font-heading text-xs md:text-sm font-semibold text-kore-gray-dark mb-1.5 md:mb-2">Historial reciente</h2>
              <div className="space-y-0.5">
                {(() => {
                  const recent = bookings
                    .filter(b => b.status === 'confirmed' || b.status === 'canceled')
                    .sort((a, b) => new Date(b.slot.starts_at).getTime() - new Date(a.slot.starts_at).getTime())
                    .slice(0, 4);
                  return recent.length > 0 ? recent.map((booking) => {
                    const d = new Date(booking.slot.starts_at);
                    const dateStr = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                    const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const isCanceled = booking.status === 'canceled';
                    return (
                      <div key={booking.id} className="flex items-center gap-1.5 md:gap-2 py-0.5 md:py-1 rounded-lg">
                        <div className={`flex-shrink-0 w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center ${isCanceled ? 'bg-red-100' : 'bg-green-100'}`}>
                          {isCanceled ? (
                            <svg className="w-2 h-2 md:w-2.5 md:h-2.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="w-2 h-2 md:w-2.5 md:h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs font-medium text-kore-gray-dark capitalize truncate">{dateStr} · {timeStr}</p>
                        </div>
                        <span className={`text-[8px] md:text-[9px] font-medium ${isCanceled ? 'text-red-500' : 'text-green-600'}`}>
                          {isCanceled ? 'Cancelada' : 'Completada'}
                        </span>
                      </div>
                    );
                  }) : (
                    <p className="text-[10px] md:text-xs text-kore-gray-dark/40 text-center py-1 md:py-1.5">Sin sesiones registradas</p>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ MOBILE: Próximas sesiones (after diagnostics) ═══════ */}
        <div className="xl:hidden bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-lg mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-sm font-semibold text-kore-gray-dark">Próximas sesiones</h2>
            <Link href="/book-session" className="text-[10px] text-kore-red font-medium hover:underline">Agendar</Link>
          </div>
          {(() => {
            const upcoming = bookings.filter(
              (b) => b.status === 'pending' && new Date(b.slot.starts_at) > new Date()
            ).sort((a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime());
            return upcoming.length > 0 ? (
              <div className="space-y-1.5">
                {upcoming.slice(0, 2).map((booking) => {
                  const d = new Date(booking.slot.starts_at);
                  const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                  const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                  return (
                    <div key={booking.id} className="flex items-center gap-2 p-2 rounded-xl bg-kore-cream/30">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-kore-red/10 flex items-center justify-center">
                        <svg className="w-3 h-3 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-kore-gray-dark capitalize truncate">{dateStr} <span className="text-kore-red">· {timeStr}</span></p>
                        <p className="text-[10px] text-kore-gray-dark/50 truncate">{booking.package?.title ?? '—'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="w-8 h-8 rounded-full bg-kore-cream mx-auto mb-1 flex items-center justify-center">
                  <CalendarIcon />
                </div>
                <p className="text-xs text-kore-gray-dark/50 mb-1">No tienes sesiones próximas</p>
                <Link href="/book-session" className="text-[10px] text-kore-red font-medium hover:underline">Agenda ahora</Link>
              </div>
            );
          })()}
        </div>

        {/* ═══════ MOBILE: Historial reciente al final ═══════ */}
        <div className="xl:hidden bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-lg mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-sm font-semibold text-kore-gray-dark">Historial reciente</h2>
          </div>
          {(() => {
            const recent = bookings
              .filter(b => b.status === 'confirmed' || b.status === 'canceled')
              .sort((a, b) => new Date(b.slot.starts_at).getTime() - new Date(a.slot.starts_at).getTime())
              .slice(0, 4);
            return recent.length > 0 ? (
              <div className="space-y-1.5">
                {recent.map((booking) => {
                  const d = new Date(booking.slot.starts_at);
                  const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                  const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const isCanceled = booking.status === 'canceled';
                  return (
                    <div key={booking.id} className="flex items-center gap-2 p-2 rounded-xl bg-kore-cream/30">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isCanceled ? 'bg-red-100' : 'bg-green-100'}`}>
                        {isCanceled ? (
                          <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-kore-gray-dark capitalize truncate">{dateStr} <span className="text-kore-red">· {timeStr}</span></p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isCanceled ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {isCanceled ? 'Cancelada' : 'Completada'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs text-kore-gray-dark/50">Sin sesiones registradas</p>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
