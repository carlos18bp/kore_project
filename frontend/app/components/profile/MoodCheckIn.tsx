'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';

const SCORE_LABELS: Record<number, string> = {
  1: 'Muy mal', 2: 'Mal', 3: 'Bajo', 4: 'Regular', 5: 'Pasable',
  6: 'Aceptable', 7: 'Bien', 8: 'Muy bien', 9: 'Excelente', 10: 'Increíble',
};

function getScoreColor(score: number) {
  if (score >= 8) return 'text-green-600 bg-green-100';
  if (score >= 5) return 'text-amber-600 bg-amber-100';
  return 'text-red-500 bg-red-100';
}

export default function MoodCheckIn() {
  const { user, hydrated } = useAuthStore();
  const { todayMood, fetchProfile, submitMood } = useProfileStore();
  const [visible, setVisible] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);
  const [score, setScore] = useState(7);
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !user || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProfile().then(() => setProfileFetched(true));
  }, [hydrated, user, fetchProfile]);

  useEffect(() => {
    if (!profileFetched) return;
    if (todayMood) return;
    if (user && !user.profile_completed) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('kore_mood_dismissed')) return;
    setVisible(true);
  }, [profileFetched, todayMood, user]);

  if (!visible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('kore_mood_dismissed', '1');
    setVisible(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await submitMood(score, notes || undefined);
    setShowConfirmation(true);
    setTimeout(() => setVisible(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute -left-6 -bottom-6 w-24 h-24 opacity-[0.05]">
          <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
        </div>

        <div className="relative z-10">
          {showConfirmation ? (
            <div className="text-center py-4 animate-in fade-in duration-300">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${getScoreColor(score)} flex items-center justify-center`}>
                <span className="font-heading text-2xl font-bold">{score}</span>
              </div>
              <p className="font-heading text-lg font-semibold text-kore-gray-dark mb-1">{SCORE_LABELS[score]}</p>
              <p className="text-sm text-kore-gray-dark/50">Registrado. ¡Gracias!</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-kore-red/10 to-kore-burgundy/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                </div>
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-1">
                  ¿Cómo te sientes hoy?
                </h2>
                <p className="text-xs text-kore-gray-dark/50">
                  Del 1 al 10, tu bienestar es parte de tu proceso.
                </p>
              </div>

              {/* Score selector */}
              <div className="mb-4">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(n)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer ${
                        n === score
                          ? getScoreColor(n) + ' ring-2 ring-offset-1 ring-current scale-110'
                          : 'bg-kore-cream/60 text-kore-gray-dark/40 hover:bg-kore-cream hover:text-kore-gray-dark/70'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className={`text-center text-sm font-medium ${
                  score >= 8 ? 'text-green-600' : score >= 5 ? 'text-amber-600' : 'text-red-500'
                }`}>
                  {SCORE_LABELS[score]}
                </p>
              </div>

              {/* Notes */}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales (opcional)"
                rows={2}
                className="w-full px-3 py-2 mb-4 rounded-xl border border-kore-gray-light/50 bg-kore-cream/30 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 focus:outline-none focus:ring-2 focus:ring-kore-red/20 resize-none"
              />

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-kore-red to-kore-burgundy text-white font-heading font-semibold text-sm rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-70"
              >
                {submitting ? 'Guardando...' : 'Registrar'}
              </button>

              <button
                onClick={handleDismiss}
                className="w-full mt-3 text-xs text-kore-gray-dark/40 hover:text-kore-gray-dark/60 transition-colors text-center"
              >
                Ahora no
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
