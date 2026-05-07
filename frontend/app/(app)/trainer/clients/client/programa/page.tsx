'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ClientProgramTab from '@/app/components/trainer/ClientProgramTab';
import SectionLabel from '@/app/components/shared/SectionLabel';

export default function TrainerClientProgramaWrapper() {
  return (
    <Suspense>
      <TrainerClientProgramaPage />
    </Suspense>
  );
}

function TrainerClientProgramaPage() {
  const searchParams = useSearchParams();
  const clientId = Number(searchParams.get('id'));

  if (!clientId) {
    return (
      <div className="p-8 text-center text-kore-gray-dark/50">Cliente no especificado.</div>
    );
  }

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">
        <Link
          href={`/trainer/clients/client?id=${clientId}`}
          className="inline-flex items-center gap-1 text-xs text-kore-gray-dark/40 hover:text-kore-red transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Volver al cliente
        </Link>

        <div>
          <SectionLabel className="mb-0.5">Plan del cliente</SectionLabel>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">Programa mensual</h1>
        </div>

        <ClientProgramTab clientId={clientId} />
      </div>
    </section>
  );
}
