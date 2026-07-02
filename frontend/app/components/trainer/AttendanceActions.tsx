'use client';

import { useState } from 'react';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';

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
  const [submitting, setSubmitting] = useState<boolean | null>(null);
  const [localStatus, setLocalStatus] = useState(session.attendance_status ?? 'unset');

  const started = !!session.starts_at && new Date(session.starts_at) <= new Date();
  if (!started || session.status === 'canceled') return null;

  if (localStatus === 'attended') {
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
