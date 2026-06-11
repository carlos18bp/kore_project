'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const KORE = {
  wineDeep: '#2D0F1A',
  ivory: '#FFF8EC',
  gold: '#E7C8A0',
};

export type LightboxPhoto = {
  src: string;
  label: string;
  sublabel?: string;
};

/* One zoomable pane: tap toggles between fit and 2.2x scrollable zoom */
function ZoomPane({ photo }: { photo: LightboxPhoto }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex flex-col items-start gap-1 px-1 pb-2">
        <span
          className="text-[10px] font-bold uppercase max-w-full truncate"
          style={{
            letterSpacing: '0.18em', color: KORE.gold,
            padding: '5px 12px', borderRadius: 999,
            background: 'rgba(255,233,220,0.08)',
            border: '1px solid rgba(231,200,160,0.30)',
          }}
        >
          {photo.label}
        </span>
        {photo.sublabel && (
          <span className="font-heading text-[12px] font-semibold" style={{ color: KORE.ivory }}>
            {photo.sublabel}
          </span>
        )}
      </div>
      <div
        className="flex-1 min-h-0 overflow-auto"
        style={{
          borderRadius: 18,
          background: '#1A0A11',
          border: '1px solid rgba(231,200,160,0.18)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.label}
          onClick={() => setZoomed((z) => !z)}
          style={
            zoomed
              ? { width: '220%', maxWidth: 'none', cursor: 'zoom-out' }
              : { width: '100%', height: '100%', objectFit: 'contain', cursor: 'zoom-in' }
          }
        />
      </div>
    </div>
  );
}

/* Fullscreen overlay to view one photo large or compare two side by side */
export default function PhotoCompareLightbox({
  photos, title, onClose,
}: {
  photos: LightboxPhoto[];
  title?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (photos.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Fotos de evaluación'}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: 'rgba(15,4,9,0.94)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          {title && (
            <h2 className="font-heading text-lg sm:text-2xl font-semibold truncate" style={{ color: KORE.ivory }}>
              {title}
            </h2>
          )}
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,233,220,0.60)' }}>
            Toca una foto para acercar · vuelve a tocar para alejar
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid place-items-center shrink-0 active:scale-95 transition-all duration-100"
          style={{
            width: 40, height: 40, borderRadius: 999, cursor: 'pointer',
            background: 'rgba(255,233,220,0.08)',
            border: '1px solid rgba(231,200,160,0.30)',
          }}
        >
          <X size={18} strokeWidth={2} color={KORE.ivory} />
        </button>
      </div>
      <div
        className={`flex-1 min-h-0 grid gap-3 px-3 pb-4 sm:px-6 sm:pb-6 ${
          photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {photos.map((p) => <ZoomPane key={p.label} photo={p} />)}
      </div>
    </div>
  );
}
