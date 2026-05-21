'use client';

// Placeholder de sección no disponible aún. La lógica real de cada página
// queda intacta detrás de su flag PHASE_3_READY; esto es solo lo que se
// muestra mientras tanto.
export default function ComingSoon({ section }: { section: string }) {
  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto">
        <div className="flex min-h-[62vh] flex-col items-center justify-center text-center">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(154,5,38,0.10), rgba(231,200,160,0.16))',
              border: '1px solid rgba(103,15,34,0.10)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#670F22" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
          </div>

          <p className="font-body text-[11px] font-bold uppercase tracking-[0.22em] text-kore-wine-dark/45">
            {section}
          </p>
          <h1 className="font-heading mt-2 text-3xl font-semibold text-kore-wine-dark">
            Próximamente
          </h1>
          <p className="font-body mt-3 max-w-sm text-[13px] leading-relaxed text-kore-wine-dark/55">
            Esta sección está en construcción y se habilitará en la{' '}
            <strong className="font-semibold text-kore-wine-dark/75">Fase 3</strong>.
          </p>

          <span
            className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{
              background: 'rgba(229,201,122,0.18)',
              color: '#A88A2E',
              border: '1px solid rgba(229,201,122,0.42)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#A88A2E' }} />
            Fase 3
          </span>
        </div>
      </div>
    </section>
  );
}
