'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

type Props = {
  /** Image URL to display. When null the viewer is not rendered. */
  url: string | null;
  alt?: string;
  onClose: () => void;
};

/** Fullscreen photo lightbox — tap a thumbnail to open, tap backdrop / X / Esc to close. */
export default function PhotoViewer({ url, alt = 'Foto', onClose }: Props) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-5"
      style={{ background: 'rgba(20,5,12,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 w-10 h-10 rounded-full grid place-items-center active:scale-95 transition-transform"
        style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
      >
        <X className="w-5 h-5" strokeWidth={2} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-[85vh] rounded-2xl object-contain"
        style={{ boxShadow: '0 24px 64px -20px rgba(0,0,0,0.7)' }}
      />
    </div>
  );
}
