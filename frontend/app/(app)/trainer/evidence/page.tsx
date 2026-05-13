'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { PhotoEntry } from '@/lib/stores/trainerStore';
import CommentSheet from '@/app/components/trainer/CommentSheet';
import HeroOrbsCard from '@/app/components/shared/HeroOrbsCard';
import SectionLabel from '@/app/components/shared/SectionLabel';
import EmptyState from '@/app/components/shared/EmptyState';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

type PhotoFilter = 'all' | 'unreviewed' | 'flagged';

const FILTER_TABS: { id: PhotoFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'unreviewed', label: 'Sin revisar' },
  { id: 'flagged', label: 'Para sesión' },
];

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  morning_snack: 'Media mañana',
  lunch: 'Almuerzo',
  afternoon_snack: 'Merienda',
  dinner: 'Cena',
};

export default function TrainerEvidencePage() {
  const {
    photoGallery,
    galleryLoading,
    fetchPhotoGallery,
    commentOnPhoto,
  } = useTrainerStore();

  const [filter, setFilter] = useState<PhotoFilter>('all');
  const [clientFilter, setClientFilter] = useState<number | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoEntry | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchPhotoGallery();
  }, [fetchPhotoGallery]);

  const uniqueClients = Array.from(
    new Map(photoGallery.map((p) => [p.customer_id, p.customer_name])).entries()
  );

  const filtered = photoGallery.filter((p) => {
    if (clientFilter !== null && p.customer_id !== clientFilter) return false;
    if (filter === 'unreviewed') return !p.trainer_comment;
    if (filter === 'flagged') return p.flagged_for_session;
    return true;
  });

  const unreviewedCount = photoGallery.filter((p) => !p.trainer_comment).length;
  const flaggedCount = photoGallery.filter((p) => p.flagged_for_session).length;

  const handleComment = async (comment: string, flagged: boolean) => {
    if (!selectedPhoto) return;
    await commentOnPhoto(selectedPhoto.meal_entry_id, comment, flagged);
    await fetchPhotoGallery();
  };

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">

        {/* Header */}
        <div data-hero="badge">
          <SectionLabel className="mb-0.5">Inteligencia</SectionLabel>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">Evidencia Fotográfica</h1>
        </div>

        {/* Hero KPI */}
        <HeroOrbsCard radius="2xl">
          <div data-hero="heading" className="p-6">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.18em] mb-1">
              Galería de comidas
            </p>
            <p className="text-5xl font-black tracking-tight text-white leading-none mb-3">
              {photoGallery.length}
            </p>
            <p className="text-white/50 text-xs leading-relaxed mb-4">
              Fotos enviadas por tus clientes. Revísalas y deja comentarios visibles para guiarlos.
            </p>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
              {unreviewedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-amber-300/20 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-amber-300" />
                  <span className="text-amber-200 text-xs font-medium">{unreviewedCount} sin revisar</span>
                </span>
              )}
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-kore-red/20 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-kore-red" />
                  <span className="text-kore-red-light text-xs font-medium">{flaggedCount} marcadas</span>
                </span>
              )}
            </div>
          </div>
        </HeroOrbsCard>

        {/* Filter chips */}
        <div data-hero="body" className="space-y-2">
          <SectionLabel>Filtrar por estado</SectionLabel>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 ${
                  filter === tab.id
                    ? 'bg-kore-gray-dark text-white shadow-sm'
                    : 'bg-white/70 backdrop-blur-sm border border-kore-gray-light/40 text-kore-gray-dark/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Client selector */}
        {uniqueClients.length > 1 && (
          <div className="space-y-2">
            <SectionLabel>Filtrar por cliente</SectionLabel>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              <button
                onClick={() => setClientFilter(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                  clientFilter === null
                    ? 'bg-kore-red text-white'
                    : 'bg-white/70 backdrop-blur-sm border border-kore-gray-light/40 text-kore-gray-dark/50'
                }`}
              >
                Todos
              </button>
              {uniqueClients.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setClientFilter(id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    clientFilter === id
                      ? 'bg-kore-red text-white'
                      : 'bg-white/70 backdrop-blur-sm border border-kore-gray-light/40 text-kore-gray-dark/50'
                  }`}
                >
                  {name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {galleryLoading && photoGallery.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-7 w-7 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No hay fotos en esta vista"
            description="Cuando un cliente suba la foto de una comida, aparecerá aquí para que la revises."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((photo) => (
              <button
                key={`${photo.log_id}-${photo.meal_entry_id}`}
                onClick={() => setSelectedPhoto(photo)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-kore-cream active:scale-95 transition-transform duration-100 group shadow-sm hover:shadow-md"
              >
                <Image
                  src={photo.photo_url}
                  alt={`${photo.customer_name} ${photo.meal_block}`}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent">
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 space-y-0.5">
                    <p className="text-white text-xs font-semibold truncate">{photo.customer_name.split(' ')[0]}</p>
                    <p className="text-white/70 text-[10px] truncate">
                      {MEAL_LABELS[photo.meal_block] ?? photo.meal_block} · {new Date(photo.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  {photo.flagged_for_session && (
                    <span className="w-5 h-5 rounded-full bg-kore-red flex items-center justify-center shadow-sm">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                      </svg>
                    </span>
                  )}
                  {!photo.trainer_comment && (
                    <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

      </div>

      {selectedPhoto && (
        <CommentSheet
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onSubmit={handleComment}
        />
      )}
    </section>
  );
}
