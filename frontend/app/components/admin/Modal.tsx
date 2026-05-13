'use client';

import { useEffect } from 'react';
import Btn from './Btn';

type Props = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function Modal({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger,
  loading,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kore-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-kore-wine-deep/55 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-7 w-full max-w-[440px] shadow-[0_30px_80px_-20px_rgba(45,15,26,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="kore-modal-title"
          className="font-heading text-xl font-semibold text-kore-burgundy mb-2.5"
        >
          {title}
        </h2>
        <div className="text-[13px] text-kore-burgundy/65 leading-relaxed mb-5">{body}</div>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Btn>
          <Btn
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
