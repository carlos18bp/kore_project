'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { MOOD_OPTIONS, MOOD_MESSAGES, MOOD_COLORS, getMoodIcon } from './ProfileIcons';

export default function MoodCheckIn() {
  const { user, hydrated } = useAuthStore();
  const { todayMood, fetchProfile, submitMood } = useProfileStore();
  const [visible, setVisible] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch profile once to know today's mood
  useEffect(() => {
    if (!hydrated || !user || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProfile().then(() => setProfileFetched(true));
  }, [hydrated, user, fetchProfile]);

  // Show modal only after profile is fetched and no mood today
  useEffect(() => {
    if (!profileFetched) return;
    if (todayMood) return;
    // Don't show if profile CTA is still showing (profile incomplete)
    if (user && !user.profile_completed) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('kore_mood_dismissed')) return;
    setVisible(true);
  }, [profileFetched, todayMood, user]);

  if (!visible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('kore_mood_dismissed', '1');
    setVisible(false);
  };

  const handleSelect = async (mood: 'motivated' | 'neutral' | 'tired') => {
    setSelectedMood(mood);
    await submitMood(mood);
    setShowConfirmation(true);
    setTimeout(() => {
      setVisible(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Decorative accent */}
        <div className="absolute -left-6 -bottom-6 w-24 h-24 opacity-[0.05]">
          <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
        </div>

        <div className="relative z-10">
          {showConfirmation && selectedMood ? (
            /* Confirmation */
            <div className="text-center py-4 animate-in fade-in duration-300">
              {(() => { const Icon = getMoodIcon(selectedMood); const colors = MOOD_COLORS[selectedMood]; return (
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${colors?.activeBg ?? 'bg-kore-cream'} flex items-center justify-center`}>
                  <Icon className={`w-8 h-8 ${colors?.text ?? 'text-kore-gray-dark'}`} />
                </div>
              ); })()}
              <p className="text-sm text-kore-gray-dark/70 leading-relaxed">
                {MOOD_MESSAGES[selectedMood]}
              </p>
            </div>
          ) : (
            /* Selection */
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-kore-red/10 to-kore-burgundy/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                </div>
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">
                  Hoy me siento...
                </h2>
                <p className="text-xs text-kore-gray-dark/50">
                  Tu bienestar emocional es parte de tu proceso.
                </p>
              </div>

              <div className="space-y-3">
                {MOOD_OPTIONS.map((opt) => {
                  const colors = MOOD_COLORS[opt.value];
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${colors.bg} hover:${colors.activeBg} ${colors.border}`}
                    >
                      <div className={`w-10 h-10 rounded-full ${colors.activeBg} flex items-center justify-center`}>
                        <opt.Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <span className="text-sm font-medium text-kore-gray-dark">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleDismiss}
                className="w-full mt-4 text-xs text-kore-gray-dark/40 hover:text-kore-gray-dark/60 transition-colors text-center"
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
