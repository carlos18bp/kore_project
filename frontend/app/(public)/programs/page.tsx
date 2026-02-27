'use client';

import Image from 'next/image';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';
import { motion, AnimatePresence } from 'framer-motion';

type ApiPackage = {
  id: number;
  title: string;
  category: string;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency: string;
  validity_days: number;
};

type ProgramMeta = {
  category: string;
  name: string;
  tagline: string;
  subtitle: string;
  description: string;
  includes: string[];
  idealFor: string[];
  image: string;
  alt: string;
  accent: string;
  accentText: string;
  accentBorder: string;
  mobileLabel: string;
};

const programMeta: ProgramMeta[] = [
  {
    category: 'personalizado',
    name: 'Personalizado FLW',
    tagline: 'Tu proceso. Tu ritmo.',
    subtitle: 'Sesiones 1:1',
    description:
      'Un proceso 1:1 diseñado para quienes buscan precisión, seguimiento cercano y máxima adaptación a sus necesidades. Cada fase está estructurada para desarrollar fuerza, movilidad y rendimiento de forma sostenible.',
    includes: [
      'Evaluación funcional inicial',
      'Planificación personalizada por fases',
      'Corrección técnica constante',
      'Progresión inteligente de cargas',
      'Seguimiento continuo del proceso',
    ],
    idealFor: [
      'Objetivos específicos de fuerza o rendimiento',
      'Procesos de transformación real',
      'Recuperación y mejora profunda',
    ],
    image: '/images/flower_leaves.webp',
    alt: 'Pétalos cayendo — Programa Personalizado',
    accent: 'bg-kore-red-bright',
    accentText: 'text-kore-red-bright',
    accentBorder: 'border-kore-red-bright',
    mobileLabel: 'Personal',
  },
  {
    category: 'semi_personalizado',
    name: 'Semi-personalizado FLW',
    tagline: 'Evolucionar en compañía, progresar con método.',
    subtitle: '2–3 personas',
    description:
      'Entrena acompañado manteniendo objetivos individuales en un entorno motivador y guiado. Combina estructura profesional con energía colectiva.',
    includes: [
      'Evaluación básica individual',
      'Plan estructurado en grupo reducido',
      'Corrección técnica personalizada',
      'Progresión controlada',
      'Trabajo funcional integral',
    ],
    idealFor: [
      'Constancia y adherencia al proceso',
      'Entrenar acompañado sin perder calidad',
      'Costo más accesible con supervisión',
    ],
    image: '/images/pose.webp',
    alt: 'Pose en movimiento — Programa Semi-personalizado',
    accent: 'bg-kore-red-light',
    accentText: 'text-kore-red-light',
    accentBorder: 'border-kore-red-light',
    mobileLabel: 'Semi',
  },
  {
    category: 'terapeutico',
    name: 'Terapéutico FLW',
    tagline: 'Recuperar el movimiento. Restaurar el equilibrio.',
    subtitle: 'Movimiento consciente',
    description:
      'Un enfoque de movimiento consciente para personas con dolor, lesiones o limitaciones que buscan recuperar función y confianza en su cuerpo. En KÓRE trabajamos desde la causa del desequilibrio.',
    includes: [
      'Evaluación funcional y postural',
      'Identificación de desbalances musculares',
      'Ejercicio terapéutico específico',
      'Fortalecimiento progresivo',
      'Estrategias preventivas',
    ],
    idealFor: [
      'Procesos de recuperación o rehabilitación',
      'Molestias recurrentes o dolor crónico',
      'Prevención y reeducación corporal',
    ],
    image: '/images/hands.webp',
    alt: 'Manos abiertas — Programa Terapéutico',
    accent: 'bg-kore-red-lightest',
    accentText: 'text-kore-red-lightest',
    accentBorder: 'border-kore-red-lightest',
    mobileLabel: 'Terapéutico',
  },
];

function formatPrice(value: number) {
  return '$' + value.toLocaleString('es-CO');
}

export default function ProgramsPageWrapper() {
  return (
    <Suspense>
      <ProgramsPage />
    </Suspense>
  );
}

function ProgramsPage() {
  // Shared state
  const [activeIndex, setActiveIndex] = useState(0);
  const [packagesByCategory, setPackagesByCategory] = useState<Record<string, ApiPackage[]>>({});
  const [loading, setLoading] = useState(true);
  const heroRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, hydrate, hydrated } = useAuthStore();

  // Desktop state
  const [desktopSelectedPlan, setDesktopSelectedPlan] = useState<number | null>(null);

  // Mobile state
  const touchStartX = useRef<number | null>(null);
  const [selectedProgramIndex, setSelectedProgramIndex] = useState<number | null>(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);

  useHeroAnimation(heroRef);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Auto-open modal if arriving with ?program=INDEX from home page
  useEffect(() => {
    const programParam = searchParams.get('program');
    if (programParam !== null) {
      const index = parseInt(programParam, 10);
      if (!isNaN(index) && index >= 0 && index < programMeta.length) {
        setActiveIndex(index);
        // Small delay to let packages load first
        const timer = setTimeout(() => {
          openProgramModal(index);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const fetchAllPackages = async () => {
      const allPackages: ApiPackage[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const url = page === 1 ? '/packages/' : `/packages/?page=${page}`;
          const { data } = await api.get(url);
          if (cancelled) return;

          if (Array.isArray(data)) {
            allPackages.push(...data);
            hasMore = false;
          } else {
            const results = data.results as ApiPackage[] | undefined;
            allPackages.push(...(results ?? []));
            hasMore = data.next !== null;
            page++;
          }
        } catch {
          break;
        }
      }

      if (cancelled) return;

      const grouped: Record<string, ApiPackage[]> = {};
      for (const pkg of allPackages) {
        if (!grouped[pkg.category]) grouped[pkg.category] = [];
        grouped[pkg.category].push(pkg);
      }
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => a.sessions_count - b.sessions_count);
      });
      setPackagesByCategory(grouped);
      setLoading(false);
    };

    fetchAllPackages();
    return () => { cancelled = true; };
  }, []);

  // Prevent background scroll and hide WhatsApp when mobile modal is open
  useEffect(() => {
    const isOpen = selectedProgramIndex !== null;
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    window.dispatchEvent(new CustomEvent('whatsapp-visibility', { detail: { hidden: isOpen } }));
    return () => {
      document.body.style.overflow = 'unset';
      window.dispatchEvent(new CustomEvent('whatsapp-visibility', { detail: { hidden: false } }));
    };
  }, [selectedProgramIndex]);

  // Derived data
  const currentProgram = programMeta[activeIndex];
  const currentPlans = packagesByCategory[currentProgram.category] ?? [];
  const currentMinPrice = currentPlans.length > 0
    ? Math.min(...currentPlans.map(p => parseFloat(p.price)))
    : null;

  // Mobile modal data
  const activeProgram = selectedProgramIndex !== null ? programMeta[selectedProgramIndex] : null;
  const activePlans = activeProgram ? (packagesByCategory[activeProgram.category] ?? []) : [];
  const selectedPkg = selectedPlanIndex !== null && activePlans.length > 0 ? activePlans[selectedPlanIndex] : null;

  // Desktop selected package
  const desktopPkg = desktopSelectedPlan !== null ? currentPlans[desktopSelectedPlan] : null;

  function handleProgramChange(index: number) {
    setActiveIndex(index);
    setDesktopSelectedPlan(null);
  }

  function openProgramModal(index: number) {
    setSelectedProgramIndex(index);
    setSelectedPlanIndex(null);
  }

  function closeProgramModal() {
    setSelectedProgramIndex(null);
  }

  return (
    <main className="bg-kore-cream min-h-screen">

      {/* ================================================================ */}
      {/* ===== DESKTOP LAYOUT (lg+): Split view — original design ===== */}
      {/* ================================================================ */}
      <section
        ref={heroRef}
        className="hidden lg:flex relative min-h-screen flex-row items-stretch overflow-hidden"
      >
        {/* Left — Content + Plans */}
        <div className="flex-1 flex items-start px-10 lg:px-14 pt-28 lg:pt-32 pb-24 z-10 overflow-y-auto">
          <div className="max-w-xl w-full">
            {/* Program Switch Tabs — Top */}
            <div className="flex gap-1 p-1.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm mb-8 w-fit">
              {programMeta.map((program, index) => (
                <button
                  key={program.category}
                  onClick={() => handleProgramChange(index)}
                  className={`relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
                    activeIndex === index
                      ? 'bg-white text-kore-gray-dark shadow-md'
                      : 'text-kore-gray-dark/60 hover:text-kore-gray-dark hover:bg-white/30'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        activeIndex === index ? program.accent : 'bg-kore-gray-dark/20'
                      }`}
                    />
                    {program.name.replace(' FLW', '')}
                  </span>
                </button>
              ))}
            </div>

            <span
              data-hero="badge"
              className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-3"
            >
              Tarifas 2026
            </span>

            <h1 data-hero="heading" className="font-heading text-3xl lg:text-4xl text-kore-gray-dark tracking-tight mb-1">
              {currentProgram.name}
            </h1>

            <p data-hero="subtitle" className="font-heading text-base text-kore-burgundy font-semibold mb-3">
              {currentProgram.tagline}
            </p>

            <p data-hero="body" className="text-sm text-kore-gray-dark/60 leading-relaxed mb-6">
              {currentProgram.description}
            </p>

            {/* Plans */}
            <div data-hero="cta" className="space-y-2.5 mb-10">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-kore-red" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : currentPlans.length === 0 ? (
                <p className="text-sm text-kore-gray-dark/40 text-center py-8">
                  No hay planes disponibles para este programa.
                </p>
              ) : (
                currentPlans.map((pkg, i) => {
                  const isSelected = desktopSelectedPlan === i;
                  const price = parseFloat(pkg.price);
                  const pricePerSession = Math.round(price / pkg.sessions_count);
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setDesktopSelectedPlan(i)}
                      className={`w-full text-left rounded-xl p-4 border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-white border-kore-red/30 shadow-md ring-1 ring-kore-red/20'
                          : 'bg-white/50 border-kore-gray-light/40 hover:bg-white/80 hover:border-kore-gray-light/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Left info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${
                              isSelected
                                ? 'border-kore-red bg-kore-red'
                                : 'border-kore-gray-dark/20 bg-transparent'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-kore-gray-dark truncate">
                              {pkg.title}
                            </p>
                            <p className="text-xs text-kore-gray-dark/40">
                              {pkg.sessions_count} {pkg.sessions_count === 1 ? 'sesión' : 'sesiones'} · {pkg.session_duration_minutes} min
                            </p>
                          </div>
                        </div>

                        {/* Right price */}
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${isSelected ? 'text-kore-red' : 'text-kore-gray-dark'}`}>
                            {formatPrice(price)}
                          </p>
                          <p className="text-[11px] text-kore-gray-dark/40">
                            {formatPrice(pricePerSession)}/sesión
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* CTA */}
            {desktopPkg && (
              <div className="flex items-center gap-3">
                <button
                  disabled={!hydrated}
                  onClick={() => {
                    if (!hydrated || !desktopPkg) return;
                    const destination = isAuthenticated
                      ? `/checkout?package=${desktopPkg.id}`
                      : `/register?package=${desktopPkg.id}`;
                    router.push(destination);
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-kore-red text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-kore-red-dark transition-colors cursor-pointer"
                >
                  Reservar {desktopPkg.title}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
                <span className="text-sm text-kore-gray-dark/40">
                  {formatPrice(parseFloat(desktopPkg.price))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right — Image */}
        <div data-hero="body" className="relative w-1/2 h-screen flex-shrink-0 order-last">
          {programMeta.map((program, index) => (
            <div
              key={program.category}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: activeIndex === index ? 1 : 0 }}
            >
              <Image
                src={program.image}
                alt={program.alt}
                fill
                sizes="50vw"
                className="object-contain object-center"
                priority={index === 0}
              />
            </div>
          ))}
          {/* Rounded vignette fade to kore-cream */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 65% 60% at center, transparent 45%, #EDE8DC 100%)' }}
          />
        </div>
      </section>

      {/* ================================================================ */}
      {/* ===== MOBILE LAYOUT (<lg): Clean image + glass bottom card ==== */}
      {/* ================================================================ */}
      <section
        className="lg:hidden relative h-screen flex flex-col"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchStartX.current === null) return;
          const diff = e.changedTouches[0].clientX - touchStartX.current;
          if (diff < -50) setActiveIndex(prev => Math.min(prev + 1, programMeta.length - 1));
          else if (diff > 50) setActiveIndex(prev => Math.max(prev - 1, 0));
          touchStartX.current = null;
        }}
      >
        {/* Background Images — clean, no overlay */}
        {programMeta.map((program, index) => (
          <div
            key={program.category}
            className={`absolute inset-0 z-0 transition-opacity duration-300 ${activeIndex === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image
              src={program.image}
              alt={program.alt}
              fill
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}

        {/* Glass Bottom Card */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-8">
          <div className="bg-white/70 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border border-white/50">
            
            {/* Program Title */}
            <h1 className="font-heading text-2xl text-kore-gray-dark font-bold tracking-tight mb-1">
              {currentProgram.name.replace(' FLW', '')}
            </h1>
            <p className="text-sm text-kore-gray-dark/60 mb-5">
              {currentProgram.tagline}
            </p>

            {/* Pill Selectors */}
            <div className="flex gap-2 mb-5">
              {programMeta.map((program, index) => (
                <button
                  key={program.category}
                  onClick={() => setActiveIndex(index)}
                  className={`flex-1 px-3 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 border ${
                    activeIndex === index
                      ? `${program.accent} text-white border-transparent shadow-md`
                      : 'bg-kore-cream/80 text-kore-gray-dark/70 border-kore-gray-light/50 hover:bg-kore-cream'
                  }`}
                >
                  {program.mobileLabel}
                </button>
              ))}
            </div>

            {/* CTA Button */}
            <button
              onClick={() => openProgramModal(activeIndex)}
              className="w-full flex items-center justify-between bg-kore-gray-dark text-white px-6 py-5 rounded-2xl shadow-lg hover:bg-black transition-colors"
            >
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold">Ver planes y precios</span>
                {currentMinPrice !== null && (
                  <span className="text-white/60 text-xs font-normal">
                    Desde {formatPrice(currentMinPrice)}
                  </span>
                )}
              </div>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>

            {/* Dot indicators */}
            <div className="flex gap-2 mt-4 justify-center">
              {programMeta.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeIndex === index ? 'w-6 bg-kore-gray-dark' : 'w-1.5 bg-kore-gray-dark/20'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* ===== MOBILE Bottom Sheet Modal ================================ */}
      {/* ================================================================ */}
      <AnimatePresence>
        {selectedProgramIndex !== null && activeProgram && (
          <>
            {/* Backdrop with Glassmorphism */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeProgramModal}
              className="fixed inset-0 bg-kore-gray-dark/40 backdrop-blur-sm z-50"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col h-[92vh] bg-[#FDFBF7] rounded-t-[32px] shadow-[0_-20px_40px_rgb(0,0,0,0.1)]"
              onPointerDownCapture={e => e.stopPropagation()}
            >
              {/* Drag Handle (Sticky) */}
              <div className="flex-shrink-0 pt-4 pb-2 px-6 bg-[#FDFBF7] rounded-t-[32px] z-20 absolute top-0 left-0 right-0 rounded-b-3xl">
                <div className="w-12 h-1.5 bg-kore-gray-light rounded-full mx-auto" />
                <button 
                  onClick={closeProgramModal}
                  className="absolute top-3 right-4 p-2 bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-full transition-colors z-30"
                >
                  <svg className="w-5 h-5 text-kore-gray-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto w-full relative pb-28 pt-8">
                
                {/* Hero Image inside Modal */}
                <div className="relative h-32 w-full mx-auto px-4 mb-4 mt-2">
                  <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-md">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10" />
                    <Image
                      src={activeProgram.image}
                      alt={activeProgram.alt}
                      fill
                      className="object-cover object-center"
                    />
                    <div className="absolute bottom-3 left-4 right-4 z-20">
                      <h2 className="font-heading text-xl font-bold text-white">
                        {activeProgram.name.replace(' FLW', '')}
                      </h2>
                      <p className="text-white/90 text-[10px] font-medium tracking-wide mt-0.5">
                        {activeProgram.subtitle}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-5 space-y-4">
                  {/* Description */}
                  <div>
                    <p className="text-xs text-kore-gray-dark/80 leading-relaxed font-medium">
                      {activeProgram.description}
                    </p>
                  </div>

                  {/* 3 Icon Summary */}
                  <div className="grid grid-cols-3 gap-2 py-4 border-y border-kore-gray-light/30">
                    <div className="flex flex-col items-center text-center gap-1.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-kore-cream ${activeProgram.accentText}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <span className="text-[9px] font-bold text-kore-gray-dark/80 uppercase tracking-wide">Evaluación<br/>Inicial</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-kore-cream ${activeProgram.accentText}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                        </svg>
                      </div>
                      <span className="text-[9px] font-bold text-kore-gray-dark/80 uppercase tracking-wide">Proceso<br/>Guiado</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-kore-cream ${activeProgram.accentText}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </div>
                      <span className="text-[9px] font-bold text-kore-gray-dark/80 uppercase tracking-wide">Seguimiento<br/>Continuo</span>
                    </div>
                  </div>

                  {/* Pricing Plans Selection */}
                  <div>
                    <h3 className="font-heading text-lg font-bold text-kore-gray-dark mb-3">Opciones Disponibles</h3>
                  
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-6 w-6 text-kore-red" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  ) : activePlans.length === 0 ? (
                    <p className="text-sm text-kore-gray-dark/40 py-4 bg-white rounded-xl text-center border border-kore-gray-light/30">
                      No hay planes disponibles para este programa.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3 pb-24">
                      {activePlans.map((pkg, i) => {
                        const isSelected = selectedPlanIndex === i;
                        const price = parseFloat(pkg.price);
                        const pricePerSession = Math.round(price / pkg.sessions_count);

                        return (
                          <button
                            key={pkg.id}
                            onClick={() => setSelectedPlanIndex(i)}
                            className={`relative flex items-center p-4 w-full text-left bg-white rounded-2xl transition-all duration-300 ${
                              isSelected 
                                ? `border-2 ${activeProgram.accentBorder} shadow-[0_8px_20px_rgb(0,0,0,0.08)] bg-[#FAFAFA]` 
                                : 'border border-kore-gray-light/60 hover:border-kore-gray-dark/20 hover:shadow-sm'
                            }`}
                          >
                            {/* Sessions Badge */}
                            <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center flex-shrink-0 mr-4 transition-colors ${
                              isSelected ? `${activeProgram.accent} text-white` : 'bg-kore-cream text-kore-gray-dark/60'
                            }`}>
                              <span className="font-heading text-base font-bold leading-none">{pkg.sessions_count}</span>
                              <span className="text-[8px] font-medium uppercase tracking-wide leading-none mt-0.5 opacity-80">ses</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-3">
                              <h4 className={`font-bold text-sm mb-0.5 truncate ${isSelected ? 'text-kore-gray-dark' : 'text-kore-gray-dark/80'}`}>
                                {pkg.title}
                              </h4>
                              <div className="flex items-center text-xs text-kore-gray-dark/50 gap-1.5">
                                <span>{formatPrice(pricePerSession)} / sesión</span>
                                <span className="w-1 h-1 rounded-full bg-kore-gray-light block" />
                                <span>{pkg.session_duration_minutes} min</span>
                              </div>
                            </div>

                            {/* Price & Radio */}
                            <div className="flex flex-col items-end flex-shrink-0">
                              <span className={`font-bold text-base mb-1 ${isSelected ? activeProgram.accentText : 'text-kore-gray-dark'}`}>
                                {formatPrice(price)}
                              </span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected ? `border-transparent ${activeProgram.accent}` : 'border-kore-gray-light'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* Bottom Sticky Action Bar inside Modal */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7] to-transparent pt-10 rounded-b-3xl">
                <button
                  disabled={!hydrated || selectedPlanIndex === null}
                  onClick={() => {
                    if (!hydrated || !selectedPkg) return;
                    const destination = isAuthenticated
                      ? `/checkout?package=${selectedPkg.id}`
                      : `/register?package=${selectedPkg.id}`;
                    router.push(destination);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl text-white font-bold transition-all shadow-lg ${
                    selectedPlanIndex !== null 
                      ? 'bg-[#1A1A1A] hover:bg-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_25px_rgba(0,0,0,0.2)]' 
                      : 'bg-kore-gray-light text-kore-gray-dark/40 cursor-not-allowed'
                  }`}
                >
                  <span className="text-sm">
                    {selectedPlanIndex !== null ? `Adquirir ${selectedPkg?.title}` : 'Selecciona un plan'}
                  </span>
                  {selectedPlanIndex !== null && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
