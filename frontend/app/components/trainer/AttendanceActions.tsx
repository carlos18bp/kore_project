'use client';

import { useState } from 'react';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

export type AttendanceSessionInput = {
  id: number;
  starts_at: string | null;
  status: string;
  attendance_status?: 'unset' | 'attended' | 'no_show';
};

/**
 * Attendance confirmation for a session that already started.
 * The credits engine penalizes unconfirmed sessions at day close (23:55),
 * so the trainer confirms from here; a late "Asistió" reverses the penalty.
 */
export default function AttendanceActions({ session }: { session: AttendanceSessionInput }) {
  const confirmAttendance = useBookingStore((s) => s.confirmAttendance);
  const markSessionAttendance = useTrainerStore((s) => s.markSessionAttendance);
  const submitRating = useSessionRatingStore((s) => s.submitRating);
  const [submitting, setSubmitting] = useState<boolean | null>(null);
  const [localStatus, setLocalStatus] = useState(session.attendance_status ?? 'unset');
  // The rating is offered only right after the trainer marks attendance, and only
  // once: attendance already succeeded, so dismissing this leaves the session unrated.
  const [rating, setRating] = useState(false);
  const [rated, setRated] = useState(false);

  const started = !!session.starts_at && new Date(session.starts_at) <= new Date();
  if (!started || session.status === 'canceled') return null;

  async function handleRate(score: number) {
    setRated(true);
    await submitRating(session.id, score);
  }

  if (localStatus === 'attended') {
    if (rating && !rated) {
      return (
        <div
          data-testid={`trainer-rating-${session.id}`}
          className="flex items-center gap-1 flex-shrink-0"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
              onClick={() => handleRate(n)}
              className="text-base leading-none text-kore-gray-dark/30 hover:text-kore-red transition-colors"
            >
              ★
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRated(true)}
            className="font-body text-[10px] text-kore-gray-dark/40 px-1"
          >
            Omitir
          </button>
        </div>
      );
    }
    return (
      <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-kore-sage/20 text-kore-sage-deep">
        Asistió
      </span>
    );
  }
  if (localStatus === 'no_show') {
    return (
      <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-red-100 text-red-600">
        No asistió
      </span>
    );
  }

  async function handle(attended: boolean) {
    setSubmitting(attended);
    const data = await confirmAttendance(session.id, attended);
    if (data) {
      const status = attended ? 'attended' : 'no_show';
      setLocalStatus(status);
      markSessionAttendance(session.id, status);
      if (attended) setRating(true);
    }
    setSubmitting(null);
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        type="button"
        onClick={() => handle(true)}
        disabled={submitting !== null}
        className="font-body text-[10px] font-bold px-2 py-1 rounded-full active:scale-95 transition-colors disabled:opacity-50"
        style={{ color: '#669959', background: 'rgba(168,194,156,0.18)' }}
      >
        {submitting === true ? 'Guardando…' : '✓ Asistió'}
      </button>
      <button
        type="button"
        onClick={() => handle(false)}
        disabled={submitting !== null}
        className="font-body text-[10px] font-bold px-2 py-1 rounded-full active:scale-95 transition-colors disabled:opacity-50"
        style={{ color: '#9A0526', background: 'rgba(154,5,38,0.08)' }}
      >
        {submitting === false ? 'Guardando…' : '✗ No asistió'}
      </button>
    </div>
  );
}
