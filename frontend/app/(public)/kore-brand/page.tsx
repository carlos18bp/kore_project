'use client';

import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';
import { useHeroAnimation, useTextReveal } from '@/app/composables/useScrollAnimations';

const petals = [
  {
    id: 'equilibrio',
    label: 'Equilibrio',
    description: 'Cada sesión busca devolver al cuerpo su centro. No se trata de forzar, sino de encontrar el punto donde todo fluye.',
    dot: { top: '15%', left: '45%' },
    card: { top: '5%', left: '58%' },
    arrow: {
      type: 'simply' as const,
      style: { top: '12%', left: '47%', transform: 'rotate(30deg)', width: 60, height: 60 },
    },
  },
  {
    id: 'consciencia',
    label: 'Consciencia',
    description: 'Entrenar con atención plena. Cada movimiento es una oportunidad de reconectar con lo que el cuerpo necesita.',
    dot: { top: '45%', left: '80%' },
    card: { top: '33%', left: '93%' },
    arrow: {
      type: 'loop' as const,
      style: { top: '40%', left: '82%', transform: 'rotate(30deg)', width: 70, height: 70 },
    },
  },
  {
    id: 'bienestar',
    label: 'Bienestar',
    description: 'Salud real que se construye día a día. No es un destino, es el camino que recorres en cada sesión.',
    dot: { top: '75%', left: '75%' },
    card: { top: '68%', left: '93%' },
    arrow: {
      type: 'simply' as const,
      style: { top: '72%', left: '77%', transform: 'rotate(25deg)', width: 60, height: 60 },
    },
  },
  {
    id: 'origen',
    label: 'Origen',
    description: 'Volver al principio. Entender de dónde viene el movimiento para construir fuerza desde la raíz.',
    dot: { top: '75%', left: '22%' },
    card: { top: '78%', right: '90%' },
    arrow: {
      type: 'loop' as const,
      style: { top: '72%', right: 'calc(100% - 21%)', transform: 'scaleX(-1) rotate(60deg)', width: 70, height: 70 },
    },
  },
  {
    id: 'movimiento',
    label: 'Movimiento',
    description: 'El cuerpo está diseñado para moverse. Devolvemos el movimiento consciente como herramienta de vida.',
    dot: { top: '30%', left: '18%' },
    card: { top: '18%', right: '93%' },
    arrow: {
      type: 'simply' as const,
      style: { top: '25%', right: 'calc(100% - 17%)', transform: 'scaleX(-1) rotate(15deg)', width: 60, height: 60 },
    },
  },
];

function AnimatedArrow({ type, style }: { type: 'loop' | 'simply'; style: React.CSSProperties }) {
  const [frame, setFrame] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev === 1 ? 2 : 1));
    }, 350);
    return () => clearInterval(interval);
  }, []);

  const src1 = type === 'loop' ? '/images/arrows/loop_arrow_1.png' : '/images/arrows/simply_arrow_1.png';
  const src2 = type === 'loop' ? '/images/arrows/loop_arrow_2.png' : '/images/arrows/simply_arrow_2.png';

  return (
    <div className="absolute pointer-events-none z-20" style={style}>
      <Image
        src={frame === 1 ? src1 : src2}
        alt=""
        width={style.width as number}
        height={style.height as number}
        className="object-contain"
        aria-hidden="true"
      />
    </div>
  );
}

export default function KoreBrandPage() {
  const heroRef = useRef<HTMLElement>(null);
  const flowerRef = useRef<HTMLElement>(null);
  useHeroAnimation(heroRef);
  useTextReveal(flowerRef);

  return (
    <main className="bg-kore-cream">
      {/* ===== HERO — Árbol + Texto ===== */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col lg:flex-row items-stretch overflow-hidden">
        {/* Tree Image — Left */}
        <div className="relative w-full lg:w-1/2 h-[60vh] lg:h-screen flex-shrink-0">
          <Image
            src="/images/tree.webp"
            alt="Árbol KÓRE — salud desde la raíz"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-contain object-bottom lg:object-center"
            priority
          />
          {/* Edge fade to kore-cream on all 4 sides */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, #EDE8DC 0%, transparent 15%)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, #EDE8DC 0%, transparent 15%)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, #EDE8DC 0%, transparent 15%)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to left, #EDE8DC 0%, transparent 15%)' }} />
        </div>

        {/* Text — Right */}
        <div className="flex-1 flex items-center px-8 md:px-12 lg:px-16 py-12 lg:py-0">
          <div className="max-w-xl">
            <span data-hero="badge" className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-6">
              La Marca
            </span>

            <h1 data-hero="heading" className="font-heading text-4xl md:text-5xl lg:text-6xl text-kore-gray-dark tracking-tight mb-6">
              KÓRE <span className="text-kore-wine-dark">Health</span>
            </h1>

            <p data-hero="subtitle" className="font-heading text-lg md:text-xl text-kore-burgundy font-semibold leading-snug mb-6">
              Del origen, al núcleo, al movimiento consciente
            </p>

            <div data-hero="body" className="space-y-4 text-base text-kore-gray-dark/75 leading-relaxed">
              <p>
                KÓRE nace de una idea muy clara: <strong className="text-kore-gray-dark font-medium">la salud se construye desde el centro de la persona.</strong>
              </p>
              <p>
                Cuando hablamos de KÓRE, hablamos del origen, del núcleo, del lugar desde donde el cuerpo se organiza, se adapta y se expresa. Y cuando hablamos de Health, hablamos de bienestar real: no solo verse bien, sino vivir mejor, moverse mejor y habitar el cuerpo con conciencia.
              </p>
              <p>
                En KÓRE no entrenamos cuerpos aislados. <strong className="text-kore-gray-dark font-medium">Acompañamos personas completas.</strong>
              </p>
            </div>

            <div data-hero="cta" className="mt-10 flex flex-col sm:flex-row gap-3">
              <a
                href="/programs"
                className="inline-flex items-center justify-center gap-2 bg-kore-red text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-kore-red-dark transition-colors"
              >
                Nuestros programas
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <button
                onClick={() => document.getElementById('esencia')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center gap-2 border border-kore-gray-dark/20 text-kore-gray-dark px-6 py-3 rounded-full text-sm font-medium hover:border-kore-red hover:text-kore-red transition-colors"
              >
                Nuestra esencia
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECCIÓN — Lo que nos hace diferentes ===== */}
      <section ref={flowerRef} className="py-10 lg:py-14 px-6 md:px-10 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-5">
            <span className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase">
              Nuestro enfoque
            </span>
            <h2 className="font-heading text-3xl md:text-4xl text-kore-gray-dark">
              Lo que nos hace diferentes
            </h2>
            <p className="text-kore-gray-dark/60 max-w-2xl mx-auto leading-relaxed">
              Nuestro proceso no comienza con ejercicios, sino con preguntas. Entrenar en KÓRE es entrar en una experiencia de salud guiada.
            </p>
          </div>

          <div data-animate="stagger-children" data-delay="0.3" className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-kore-red/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold text-kore-gray-dark mb-3">Desde el origen</h3>
              <p className="text-sm text-kore-gray-dark/60 leading-relaxed">
                Entrenamos desde el origen del movimiento. Entendemos el cuerpo como un sistema vivo donde todo está conectado: postura, movimiento, respiración y fuerza.
              </p>
            </div>

            <div className="text-center p-8">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-kore-red/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold text-kore-gray-dark mb-3">Salud antes que exigencia</h3>
              <p className="text-sm text-kore-gray-dark/60 leading-relaxed">
                La salud no se trata solo de no tener dolor. Es moverse con libertad, tener control del propio cuerpo y sentirse seguro al entrenar.
              </p>
            </div>

            <div className="text-center p-8">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-kore-red/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold text-kore-gray-dark mb-3">Procesos, no atajos</h3>
              <p className="text-sm text-kore-gray-dark/60 leading-relaxed">
                Cada decisión tiene sentido y cada sesión construye algo más profundo que un resultado estético. El usuario no solo entrena: aprende a entender su cuerpo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECCIÓN — Flor Interactiva (Esencia) ===== */}
      <section id="esencia" className="relative overflow-hidden">
        <div className="flex items-center justify-center min-h-screen py-6">
          <div className="relative w-[90vmin] h-[90vmin]">
            <Image
              src="/images/flower.webp"
              alt="Flor de KÓRE — cinco pilares de la marca"
              fill
              sizes="90vmin"
              className="object-contain"
            />
            {/* Edge fade to kore-cream on all 4 sides */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, #EDE8DC 0%, transparent 15%)' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, #EDE8DC 0%, transparent 15%)' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, #EDE8DC 0%, transparent 15%)' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to left, #EDE8DC 0%, transparent 15%)' }} />

            {petals.map((petal) => (
              <div key={petal.id}>
                {/* Dot */}
                <div
                  className="absolute z-30"
                  style={{ top: petal.dot.top, left: petal.dot.left }}
                >
                  <span className="block w-3.5 h-3.5 rounded-full bg-kore-red border-2 border-kore-red shadow-md shadow-kore-red/20" />
                </div>

                {/* Arrow */}
                <AnimatedArrow
                  type={petal.arrow.type}
                  style={petal.arrow.style}
                />

                {/* Card — always visible */}
                <div
                  className="absolute z-20 w-52 pointer-events-none"
                  style={petal.card}
                >
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-kore-gray-light/40">
                    <p className="font-heading text-sm font-semibold text-kore-wine-dark uppercase tracking-wide mb-1">
                      {petal.label}
                    </p>
                    <p className="text-xs text-kore-gray-dark/60 leading-relaxed">
                      {petal.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECCIÓN — Diagnóstico ===== */}
      <section className="py-10 lg:py-14 px-6 md:px-10 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-4">
              El proceso
            </span>
            <h2 className="font-heading text-3xl md:text-4xl text-kore-gray-dark mb-4">
              Tu camino en KÓRE
            </h2>
            <p className="text-kore-gray-dark/60 max-w-2xl mx-auto leading-relaxed">
              Todo comienza con un diagnóstico. No para etiquetarte, sino para entenderte y cuidarte mejor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            {/* Fase 1 */}
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/40">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center text-kore-red font-heading text-sm font-semibold">1</span>
                <h3 className="font-heading text-lg font-semibold text-kore-gray-dark">Primer contacto</h3>
              </div>
              <ul className="space-y-3 text-sm text-kore-gray-dark/65 leading-relaxed">
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Anamnesis completa e historial médico</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Historia clínica deportiva y hábitos de vida</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Identificación del objetivo principal</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Detección de patologías o restricciones</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Evaluación postural básica</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Orientación hacia el programa más adecuado</li>
              </ul>
            </div>

            {/* Fase 2 */}
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/40">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center text-kore-red font-heading text-sm font-semibold">2</span>
                <h3 className="font-heading text-lg font-semibold text-kore-gray-dark">Diagnóstico completo</h3>
              </div>
              <ul className="space-y-3 text-sm text-kore-gray-dark/65 leading-relaxed">
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Evaluación postural y análisis fotográfico</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Condición física: aeróbica y anaeróbica</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Movilidad articular y funcional</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Identificación de riesgos y limitaciones</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Definición de objetivos reales y progresivos</li>
                <li className="flex gap-2"><span className="text-kore-red mt-0.5">•</span>Asignación del programa: Personalizado, Semi o Terapéutico</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECCIÓN — Programas ===== */}
      <section className="py-10 lg:py-14 px-6 md:px-10 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-4">
              Programas
            </span>
            <h2 className="font-heading text-3xl md:text-4xl text-kore-gray-dark mb-4">
              Tres caminos, un mismo centro
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/40">
              <div className="w-3 h-3 rounded-full bg-kore-red-bright mb-4" />
              <h3 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Personalizado FLW</h3>
              <p className="text-xs text-kore-red uppercase tracking-wider mb-4">Uno a uno</p>
              <p className="text-sm text-kore-gray-dark/60 leading-relaxed mb-4">
                Para personas que buscan un proceso profundo y completamente guiado. Cada sesión se adapta al estado real de la persona y a su evolución.
              </p>
              <ul className="space-y-2 text-xs text-kore-gray-dark/50">
                <li>→ Salud integral y corrección postural</li>
                <li>→ Reducción de grasa / aumento muscular</li>
                <li>→ Rendimiento físico</li>
                <li>→ Procesos de recuperación</li>
              </ul>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/40">
              <div className="w-3 h-3 rounded-full bg-kore-red-light mb-4" />
              <h3 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Semi-personalizado FLW</h3>
              <p className="text-xs text-kore-red uppercase tracking-wider mb-4">2–3 personas</p>
              <p className="text-sm text-kore-gray-dark/60 leading-relaxed mb-4">
                Mayor motivación y adherencia. Cada persona tiene objetivos propios pero entrena en un entorno compartido, guiado y consciente.
              </p>
              <ul className="space-y-2 text-xs text-kore-gray-dark/50">
                <li>→ Acompañamiento técnico constante</li>
                <li>→ Ambiente cercano y controlado</li>
                <li>→ Costo más accesible</li>
                <li>→ Objetivos individuales</li>
              </ul>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/40">
              <div className="w-3 h-3 rounded-full bg-kore-red-lightest mb-4" />
              <h3 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Terapéutico FLW</h3>
              <p className="text-xs text-kore-red uppercase tracking-wider mb-4">Movimiento como herramienta</p>
              <p className="text-sm text-kore-gray-dark/60 leading-relaxed mb-4">
                El movimiento como herramienta terapéutica, no como castigo. Para quienes necesitan reconstruir la confianza en su cuerpo.
              </p>
              <ul className="space-y-2 text-xs text-kore-gray-dark/50">
                <li>→ Dolor crónico y rehabilitación</li>
                <li>→ Artrosis y desgaste articular</li>
                <li>→ Postoperatorios y post lesión</li>
                <li>→ Adultos mayores</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECCIÓN — Seguimiento ===== */}
      <section className="py-10 lg:py-14 px-6 md:px-10 lg:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-4">
            Acompañamiento
          </span>
          <h2 className="font-heading text-3xl md:text-4xl text-kore-gray-dark mb-6">
            El seguimiento es constante
          </h2>
          <p className="text-kore-gray-dark/60 max-w-2xl mx-auto leading-relaxed mb-12">
            El usuario no solo entrena: aprende a entender su cuerpo. El acompañamiento en KÓRE es cercano y educativo.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Ajuste progresivo', desc: 'Ejercicios y cargas adaptadas' },
              { label: 'Corrección postural', desc: 'Durante cada ejecución' },
              { label: 'Movilidad funcional', desc: 'Biomecánica aplicada' },
              { label: 'Educación', desc: 'Explicación de cada ejercicio' },
            ].map((item) => (
              <div key={item.label} className="p-5 rounded-xl bg-white/50 border border-kore-gray-light/30">
                <p className="font-heading text-sm font-semibold text-kore-wine-dark mb-1">{item.label}</p>
                <p className="text-xs text-kore-gray-dark/50">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 inline-flex items-center gap-2 text-sm text-kore-gray-dark/40">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            Evaluaciones cada 3 meses: antropometría, posturometría y reajuste de objetivos
          </div>
        </div>
      </section>
    </main>
  );
}
