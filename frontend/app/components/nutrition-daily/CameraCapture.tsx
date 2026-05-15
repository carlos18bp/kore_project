'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Check } from 'lucide-react';

export type FacingMode = 'user' | 'environment';

interface Props {
  facingMode: FacingMode;
  title: string;
  hint?: string;
  onCapture: (file: File) => Promise<void> | void;
  onClose: () => void;
}

const STREAM_CONSTRAINTS = (facing: FacingMode): MediaStreamConstraints => ({
  video: {
    facingMode: { ideal: facing },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
});

/**
 * Full-screen camera modal that captures frames via getUserMedia + canvas.
 *
 * Why getUserMedia instead of `<input type="file" capture>`:
 *  - There is no file picker in the flow. The user cannot pick a gallery image.
 *  - DevTools mobile emulation cannot bypass it — without a real camera (or a
 *    granted webcam), getUserMedia rejects and we show an error state.
 */
export default function CameraCapture({
  facingMode,
  title,
  hint,
  onCapture,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  // Acquire the camera stream on mount, release on unmount.
  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('Este dispositivo no expone una cámara accesible.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia(STREAM_CONSTRAINTS(facingMode));
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('Permiso de cámara denegado. Activalo en los ajustes del navegador.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('No se detectó una cámara en este dispositivo.');
        } else {
          setError('No se pudo abrir la cámara. Asegurate de estar en un teléfono con permiso de cámara.');
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror the front-camera capture so the preview matches what the user sees.
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        setCapturedFile(file);
        setPreview(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleAccept = async () => {
    if (!capturedFile) return;
    setBusy(true);
    try {
      await onCapture(capturedFile);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRetake = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCapturedFile(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-black/70 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>
        <p className="font-heading text-sm font-semibold tracking-[0.18em] uppercase text-kore-ivory">
          {title}
        </p>
        <span className="w-10" aria-hidden="true" />
      </div>

      {/* Stage */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center px-8 max-w-sm">
            <div className="w-14 h-14 rounded-full bg-kore-crimson/20 flex items-center justify-center mx-auto mb-4">
              <Camera className="w-7 h-7 text-kore-crimson" />
            </div>
            <p className="text-base font-semibold mb-2">No podemos abrir la cámara</p>
            <p className="text-sm text-white/65 leading-relaxed">{error}</p>
            <p className="text-xs text-white/45 mt-4 leading-relaxed">
              Esta acción solo se puede hacer con la cámara del teléfono. Subir archivos no está permitido.
            </p>
          </div>
        ) : preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={preview} alt="Captura" className="w-full h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        )}
      </div>

      {/* Hint */}
      {hint && !error && !preview && (
        <p className="text-center text-xs text-white/55 px-6 pb-3">{hint}</p>
      )}

      {/* Controls */}
      <div className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 bg-black/70 backdrop-blur-md">
        {error ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white/10 text-sm font-semibold active:scale-95 transition"
          >
            Cerrar
          </button>
        ) : preview ? (
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleRetake}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 text-sm font-semibold active:scale-95 transition disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Repetir
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-kore-gold text-kore-wine-deep text-sm font-semibold active:scale-95 transition disabled:opacity-50"
            >
              {busy ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-kore-wine-deep border-t-transparent rounded-full" />
              ) : (
                <Check className="w-4 h-4" strokeWidth={2.5} />
              )}
              Usar foto
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleSnap}
              disabled={!ready}
              aria-label="Capturar"
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center active:scale-95 transition disabled:opacity-40 ring-4 ring-white/20"
            >
              <span className="w-16 h-16 rounded-full bg-white border-4 border-kore-wine-deep" />
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
