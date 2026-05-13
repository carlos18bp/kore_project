'use client';

import { useEffect, useState } from 'react';
import { useParqStore, ParqFormData, ParqAssessment } from '@/lib/stores/parqStore';

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

const QUESTIONS: { key: keyof Omit<ParqFormData, 'additional_notes'>; text: string; detail: string }[] = [
  {
    key: 'q1_heart_condition',
    text: '¿Algún médico le ha dicho que tiene una condición cardíaca O presión arterial alta?',
    detail: 'Incluye diagnóstico de hipertensión, enfermedad coronaria, arritmias u otra condición cardiovascular.',
  },
  {
    key: 'q2_chest_pain',
    text: '¿Siente dolor en el pecho en reposo, en actividades diarias, o al hacer actividad física?',
    detail: 'Dolor, presión o molestia en el pecho en cualquier momento.',
  },
  {
    key: 'q3_dizziness',
    text: '¿Pierde el equilibrio por mareos O ha perdido el conocimiento en los últimos 12 meses?',
    detail: 'Episodios de vértigo, desmayo o pérdida de consciencia reciente.',
  },
  {
    key: 'q4_chronic_condition',
    text: '¿Le han diagnosticado alguna condición médica crónica?',
    detail: 'Diferente a enfermedad cardíaca o presión alta. Ejemplos: diabetes, EPOC, artritis, cáncer, enfermedad renal.',
  },
  {
    key: 'q5_prescribed_medication',
    text: '¿Actualmente toma medicamentos recetados para una condición médica crónica?',
    detail: 'Cualquier medicamento recetado por un médico para una condición de salud persistente.',
  },
  {
    key: 'q6_bone_joint_problem',
    text: '¿Tiene actualmente un problema óseo, articular o de tejidos blandos que podría empeorar con actividad física?',
    detail: 'En los últimos 12 meses: problemas en huesos, articulaciones, músculos, ligamentos o tendones.',
  },
  {
    key: 'q7_medical_supervision',
    text: '¿Algún médico le ha dicho que solo debe hacer actividad física con supervisión médica?',
    detail: 'Recomendación explícita de un profesional de salud sobre supervisión durante el ejercicio.',
  },
];

const INITIAL_FORM: ParqFormData = {
  q1_heart_condition: false,
  q2_chest_pain: false,
  q3_dizziness: false,
  q4_chronic_condition: false,
  q5_prescribed_medication: false,
  q6_bone_joint_problem: false,
  q7_medical_supervision: false,
  additional_notes: '',
};

function ResultBadge({ assessment }: { assessment: ParqAssessment }) {
  return (
    <div className={`rounded-2xl border p-6 ${COLOR_BG[assessment.risk_color] || 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${COLOR_MAP[assessment.risk_color] || 'bg-gray-400'}`}>
          {assessment.risk_color === 'green' && (
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {assessment.risk_color === 'yellow' && (
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          {assessment.risk_color === 'red' && (
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div>
          <p className={`text-xl font-semibold ${COLOR_TEXT[assessment.risk_color] || 'text-gray-600'}`}>
            {assessment.risk_label}
          </p>
          <p className="text-sm text-kore-gray-dark/50">
            {assessment.yes_count} de 7 respuestas afirmativas
          </p>
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ assessment }: { assessment: ParqAssessment }) {
  const date = new Date(assessment.created_at).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-kore-gray-light/30">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${COLOR_MAP[assessment.risk_color] || 'bg-gray-400'}`}>
        <span className="text-white text-sm font-bold">{assessment.yes_count}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-kore-gray-dark">{assessment.risk_label}</p>
        <p className="text-xs text-kore-gray-dark/40">{date}</p>
      </div>
    </div>
  );
}

export default function MyParqPage() {
  const { assessments, loading, submitting, error, fetchMyAssessments, createAssessment } = useParqStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ParqFormData>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchMyAssessments();
  }, [fetchMyAssessments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createAssessment(form);
    if (result) {
      setShowForm(false);
      setForm(INITIAL_FORM);
      setSubmitted(true);
    }
  };

  const toggleQuestion = (key: keyof Omit<ParqFormData, 'additional_notes'>) => {
    setForm({ ...form, [key]: !form[key] });
  };

  const latest = assessments[0] || null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-2">PAR-Q+</h1>
      <p className="text-sm text-kore-gray-dark/50 mb-8">
        Cuestionario de Preparación para la Actividad Física. Tu seguridad es nuestra prioridad.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {submitted && !error && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          Evaluación PAR-Q guardada correctamente.
        </div>
      )}

      {/* Latest result */}
      {latest && !showForm && (
        <div className="mb-8">
          <ResultBadge assessment={latest} />
        </div>
      )}

      {/* New assessment button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setSubmitted(false); }}
          className="w-full mb-8 py-3 px-6 rounded-xl bg-kore-red text-white font-medium hover:bg-kore-red-dark transition-colors"
        >
          {latest ? 'Actualizar PAR-Q (cada 3 meses)' : 'Completar PAR-Q'}
        </button>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-kore-gray-light/40 p-6 shadow-sm mb-8 space-y-4">
          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">
            Preguntas generales de salud
          </h2>
          <p className="text-xs text-kore-gray-dark/50 mb-4">
            Responde Sí o No a cada pregunta con honestidad. Esta información es confidencial y se usa para adaptar tu programa de forma segura.
          </p>

          {QUESTIONS.map((q, i) => (
            <div key={q.key} className="border border-kore-gray-light/30 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-kore-cream flex items-center justify-center text-xs font-semibold text-kore-gray-dark">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-kore-gray-dark">{q.text}</p>
                  <p className="text-xs text-kore-gray-dark/40 mt-1">{q.detail}</p>
                </div>
              </div>
              <div className="flex gap-3 ml-10">
                <button
                  type="button"
                  onClick={() => toggleQuestion(q.key)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    form[q.key]
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-kore-gray-dark/60 border-kore-gray-light/50 hover:border-red-200'
                  }`}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, [q.key]: false })}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    !form[q.key]
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-kore-gray-dark/60 border-kore-gray-light/50 hover:border-emerald-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          ))}

          {/* Additional notes */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              Notas adicionales (opcional)
            </label>
            <textarea
              value={form.additional_notes}
              onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none resize-none"
              placeholder="¿Algún detalle adicional sobre tu estado de salud?"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Enviar'}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      {assessments.length > 0 && (
        <div className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Historial</h2>
          <div className="space-y-3">
            {assessments.map((a) => (
              <HistoryCard key={a.id} assessment={a} />
            ))}
          </div>
        </div>
      )}

      {/* Scientific basis */}
      <div className="bg-kore-cream/50 rounded-2xl p-6 border border-kore-gray-light/20">
        <h3 className="font-heading text-base font-semibold text-kore-gray-dark mb-3">Base científica</h3>
        <ul className="space-y-2 text-xs text-kore-gray-dark/60">
          <li>PAR-Q+ (2024). Physical Activity Readiness Questionnaire for Everyone. CSEP / ePARmed-X+.</li>
          <li>Warburton DER et al. (2011). The PAR-Q+ and ePARmed-X+. HFJC, 4(2):3-23.</li>
          <li>Thomas S, Reading J, Shephard RJ (1992). Revision of PAR-Q. Can J Sport Sci.</li>
          <li>ACSM (2021). Guidelines for Exercise Testing and Prescription, 11th ed.</li>
        </ul>
        <p className="text-xs text-kore-gray-dark/40 mt-3">
          Este cuestionario es un filtro de seguridad, no reemplaza una valoración médica. 
          Validez máxima: 12 meses desde la fecha de diligenciamiento.
        </p>
      </div>

      {loading && assessments.length === 0 && (
        <div className="text-center py-12 text-kore-gray-dark/40">Cargando...</div>
      )}
    </div>
  );
}
