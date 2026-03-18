'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useParqStore, ParqAssessment } from '@/lib/stores/parqStore';

const COLOR_MAP: Record<string, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  green: 'bg-emerald-500',
};

const COLOR_TEXT: Record<string, string> = {
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  green: 'text-emerald-600',
};

const COLOR_BG: Record<string, string> = {
  red: 'bg-red-50 border-red-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  green: 'bg-emerald-50 border-emerald-200',
};

const QUESTION_LABELS: { key: string; text: string }[] = [
  { key: 'q1_heart_condition', text: 'Condición cardíaca / presión alta' },
  { key: 'q2_chest_pain', text: 'Dolor en el pecho' },
  { key: 'q3_dizziness', text: 'Mareos / pérdida de consciencia' },
  { key: 'q4_chronic_condition', text: 'Condición médica crónica' },
  { key: 'q5_prescribed_medication', text: 'Medicamentos recetados' },
  { key: 'q6_bone_joint_problem', text: 'Problema óseo / articular' },
  { key: 'q7_medical_supervision', text: 'Supervisión médica requerida' },
];

function AssessmentCard({ assessment }: { assessment: ParqAssessment }) {
  const date = new Date(assessment.created_at).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-kore-gray-light/40 p-6 shadow-sm">
      <div className={`rounded-xl border p-4 mb-4 ${COLOR_BG[assessment.risk_color] || 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${COLOR_MAP[assessment.risk_color] || 'bg-gray-400'}`}>
            <span className="text-white font-bold text-sm">{assessment.yes_count}</span>
          </div>
          <div>
            <p className={`font-semibold ${COLOR_TEXT[assessment.risk_color] || 'text-gray-600'}`}>
              {assessment.risk_label}
            </p>
            <p className="text-xs text-kore-gray-dark/40">{date} &mdash; {assessment.yes_count}/7 afirmativas</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {QUESTION_LABELS.map((q) => {
          const val = assessment[q.key as keyof ParqAssessment] as boolean;
          return (
            <div key={q.key} className="flex items-center justify-between bg-kore-cream/30 rounded-lg px-3 py-2">
              <span className="text-xs text-kore-gray-dark/60">{q.text}</span>
              <span className={`text-xs font-semibold ${val ? 'text-red-600' : 'text-emerald-600'}`}>
                {val ? 'Sí' : 'No'}
              </span>
            </div>
          );
        })}
      </div>

      {assessment.additional_notes && (
        <div className="mt-3 p-3 bg-kore-cream/20 rounded-lg">
          <p className="text-xs text-kore-gray-dark/60">
            <strong>Notas:</strong> {assessment.additional_notes}
          </p>
        </div>
      )}
    </div>
  );
}

function TrainerClientParqContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const { assessments, loading, error, fetchClientAssessments } = useParqStore();

  useEffect(() => {
    if (clientId) {
      fetchClientAssessments(parseInt(clientId));
    }
  }, [clientId, fetchClientAssessments]);

  if (!clientId) {
    return <div className="p-8 text-kore-gray-dark/40">Cliente no especificado.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-2">PAR-Q+ del Cliente</h1>
      <p className="text-sm text-kore-gray-dark/50 mb-8">
        Historial de evaluaciones PAR-Q+ completadas por el cliente.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && assessments.length === 0 && (
        <div className="text-center py-12 text-kore-gray-dark/40">Cargando...</div>
      )}

      {!loading && assessments.length === 0 && (
        <div className="text-center py-12">
          <p className="text-kore-gray-dark/40">El cliente aún no ha completado el PAR-Q+.</p>
        </div>
      )}

      <div className="space-y-6">
        {assessments.map((a) => (
          <AssessmentCard key={a.id} assessment={a} />
        ))}
      </div>
    </div>
  );
}

export default function TrainerClientParqPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-kore-gray-dark/40">Cargando...</div>}>
      <TrainerClientParqContent />
    </Suspense>
  );
}
