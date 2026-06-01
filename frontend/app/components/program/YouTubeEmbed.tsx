'use client';

import { useState } from 'react';

type Props = {
  url: string;
  title?: string;
};

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
  } catch {}
  return null;
}

export default function YouTubeEmbed({ url, title = 'Ejercicio' }: Props) {
  const [loaded,       setLoaded]       = useState(false);
  const [thumbFailed,  setThumbFailed]  = useState(false);
  const videoId = extractVideoId(url);

  if (!videoId) return null;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  // mqdefault returns a real 404 for deleted/private videos (unlike hqdefault which may serve a placeholder)
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  if (thumbFailed) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/>
          </svg>
          <p className="text-xs text-slate-500 font-medium">Video no disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
      {!loaded ? (
        <button
          onClick={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full group"
          aria-label={`Reproducir video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbUrl}
            alt={title}
            className="w-full h-full object-cover"
            onError={() => setThumbFailed(true)}
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6 text-kore-red ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      ) : (
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          // El sitio sirve Referrer-Policy: same-origin, que omite el Referer en
          // peticiones cross-origin; sin Referer el reproductor de YouTube falla.
          // Forzamos el envío del origin sólo para este iframe.
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      )}
    </div>
  );
}
