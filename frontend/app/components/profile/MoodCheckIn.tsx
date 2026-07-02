'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';

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
  const { profile, todayMood, fetchProfile, submitMood, moodModalOpen, closeMoodModal } = useProfileStore();
  const [autoVisible, setAutoVisible] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);
  const [step, setStep] = useState(0); // 0 ánimo · 1 energía · 2 dolor · 3 listo
  const [score, setScore] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [pain, setPain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fetchedRef = useRef(false);

  const { value: creditValue, fetchValues } = useCreditValuesStore();
  useEffect(() => { fetchValues(); }, [fetchValues]);
  const checkinCredits = creditValue('checkin');

  useEffect(() => {
    if (!hydrated || !user || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProfile().then(() => setProfileFetched(true));
  }, [hydrated, user, fetchProfile]);

  // Gate the auto-open behind the strict customer-profile flag so the mood modal
  // never stacks on top of ProfileCompletionCTA. authStore's user.profile_completed
  // is looser than profileStore's customer_profile.profile_completed; requiring both
  // keeps priority as: change-password (redirect) → profile completion → mood.
  const customerProfileComplete = profile?.customer_profile?.profile_completed === true;
  const profileFullyComplete = user?.profile_completed === true && customerProfileComplete;

  useEffect(() => {
    if (!profileFetched) return;
    if (todayMood) return;
    if (!profileFullyComplete) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('kore_mood_dismissed')) return;
    setAutoVisible(true);
  }, [profileFetched, todayMood, profileFullyComplete]);

  // Manual opens via the dashboard CTA take precedence over the auto-show flow and
  // ignore the kore_mood_dismissed flag (the user is explicitly asking for it).
  const visible = autoVisible || moodModalOpen;

  if (!visible) return null;

  const handleDismiss = () => {
    if (autoVisible) {
      sessionStorage.setItem('kore_mood_dismissed', '1');
      setAutoVisible(false);
    }
    if (moodModalOpen) closeMoodModal();
  };

  const handleSubmit = async (readyAnswer: boolean) => {
    if (score === null) return;
    setSubmitting(true);
    await submitMood(score, notes || undefined, {
      ...(energy !== null ? { energy_level: energy } : {}),
      ...(pain !== null ? { pain } : {}),
      ready_to_train: readyAnswer,
    });
    setShowConfirmation(true);
    setTimeout(() => {
      setAutoVisible(false);
      if (moodModalOpen) closeMoodModal();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-white/40 backdrop-blur-md" onClick={handleDismiss} />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute -left-6 -bottom-6 w-24 h-24 opacity-[0.05]">
          <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
        </div>

        <div className="relative z-10">
          {showConfirmation ? (
            <div className="text-center py-4 animate-in fade-in duration-300">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${getScoreColor(score ?? 7)} flex items-center justify-center`}>
                <span className="font-heading text-2xl font-bold">{score ?? '—'}</span>
              </div>
              <p className="font-heading text-lg font-semibold text-kore-gray-dark mb-1">{SCORE_LABELS[score ?? 7]}</p>
              <p className="text-sm text-kore-gray-dark/50">Registrado. ¡Gracias!</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-kore-red' : i < step ? 'w-1.5 bg-kore-red/40' : 'w-1.5 bg-kore-gray-light'}`} />
                  ))}
                </div>
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-1">
                  {step === 0 && '¿Cómo te sientes hoy?'}
                  {step === 1 && '¿Cuánta energía tienes?'}
                  {step === 2 && '¿Tienes algún dolor o molestia?'}
                  {step === 3 && '¿Listo para entrenar hoy?'}
                </h2>
                {checkinCredits !== null && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-kore-red/10 text-kore-red">
                    Check-in de hoy · +{checkinCredits} créditos
                  </span>
                )}
              </div>

              {step === 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap mb-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { setScore(n); setTimeout(() => setStep(1), 250); }}
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
                  {score !== null && (
                    <p className="text-center text-sm font-medium text-kore-gray-dark/60">{SCORE_LABELS[score]}</p>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="mb-4 flex items-center justify-center gap-2">
                  {[
                    { n: 1, label: 'Agotado' }, { n: 2, label: 'Bajo' }, { n: 3, label: 'Normal' },
                    { n: 4, label: 'Bien' }, { n: 5, label: 'A tope' },
                  ].map(({ n, label }) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setEnergy(n); setTimeout(() => setStep(2), 250); }}
                      className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                        energy === n ? 'bg-kore-red/10 text-kore-red ring-1 ring-kore-red/30' : 'bg-kore-cream/60 text-kore-gray-dark/50 hover:bg-kore-cream'
                      }`}
                    >
                      <span className="text-base font-bold">{n}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="mb-4 flex items-center justify-center gap-3">
                  <button type="button" onClick={() => { setPain(false); setTimeout(() => setStep(3), 250); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${pain === false ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-kore-cream/60 text-kore-gray-dark/60 hover:bg-kore-cream'}`}>
                    Sin dolor
                  </button>
                  <button type="button" onClick={() => { setPain(true); setTimeout(() => setStep(3), 250); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${pain === true ? 'bg-red-100 text-red-600 ring-1 ring-red-300' : 'bg-kore-cream/60 text-kore-gray-dark/60 hover:bg-kore-cream'}`}>
                    Tengo dolor
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="mb-4 space-y-3">
                  {pain === true && (
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Cuéntale a tu entrenador dónde te duele (opcional)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-kore-gray-light/50 bg-kore-cream/30 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 focus:outline-none focus:ring-2 focus:ring-kore-red/20 resize-none"
                    />
                  )}
                  <div className="flex items-center justify-center gap-3">
                    <button type="button" disabled={submitting} onClick={() => handleSubmit(true)}
                      className="flex-1 py-3 bg-gradient-to-r from-kore-red to-kore-burgundy text-white font-heading font-semibold text-sm rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-70">
                      {submitting ? 'Guardando...' : '¡Listo para entrenar!'}
                    </button>
                    <button type="button" disabled={submitting} onClick={() => handleSubmit(false)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold bg-kore-cream/60 text-kore-gray-dark/60 hover:bg-kore-cream transition-all disabled:opacity-70">
                      Hoy no
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleDismiss}
                className="w-full mt-2 text-xs text-kore-gray-dark/40 hover:text-kore-gray-dark/60 transition-colors text-center"
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
