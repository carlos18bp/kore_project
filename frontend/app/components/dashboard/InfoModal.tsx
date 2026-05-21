'use client';

import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Mini-modal informativo. Se usa para explicar los badges del header del
 * dashboard (racha, récord, índice KÓRE). Se cierra con la X, tocando el
 * fondo o con Escape.
 */
export default function InfoModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: 'rgba(45,15,26,0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-[22px] bg-white p-5 shadow-[0_24px_60px_-20px_rgba(45,15,26,0.5)]"
      >
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <h2 className="font-heading text-[17px] font-semibold text-kore-wine-dark">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-kore-gray-dark/45 transition hover:bg-kore-gray-dark/5 active:scale-90"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="font-body text-[13px] leading-relaxed text-kore-gray-dark/80">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
