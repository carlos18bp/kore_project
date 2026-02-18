'use client';

import Link from 'next/link';

type Props = {
  packageTitle?: string;
};

export default function NoSessionsModal({ packageTitle }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-kore-red/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        </div>

        <h3 className="font-heading text-lg font-semibold text-kore-gray-dark text-center mb-2">
          Sin sesiones disponibles
        </h3>
        <p className="text-sm text-kore-gray-dark/60 text-center mb-2">
          Has utilizado todas las sesiones de tu programa
          {packageTitle && <span className="font-semibold text-kore-gray-dark"> {packageTitle}</span>}.
        </p>
        <p className="text-sm text-kore-gray-dark/60 text-center mb-6">
          Para seguir disfrutando de nuestros servicios, adquiere un nuevo programa.
        </p>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors text-center cursor-pointer"
          >
            Volver al inicio
          </Link>
          <Link
            href="/subscription"
            className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-semibold text-center hover:bg-kore-red/90 transition-colors cursor-pointer"
          >
            Ver programas
          </Link>
        </div>
      </div>
    </div>
  );
}
