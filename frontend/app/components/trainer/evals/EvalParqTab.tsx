'use client';

import { useEffect } from 'react';
import { useParqStore, type ParqAssessment } from '@/lib/stores/parqStore';
import {
  T, FormHero, FormSection, YesNoToggle, ComputedCard, NotesField, EvalEmptyState, EvalSpinner,
} from './shared';

const QUESTIONS = [
  'Le han diagnosticado alguna condición cardíaca o hipertensión arterial.',
  'Siente dolor en el pecho en reposo, durante la actividad diaria o al ejercitarse.',
  'Ha perdido el equilibrio por mareo o se ha desmayado en los últimos 12 meses.',
  'Tiene alguna otra condición médica crónica (diabetes, enfermedad renal, etc.).',
  'Está tomando algún medicamento prescrito actualmente.',
  'Tiene algún problema óseo, articular o muscular que empeore con el ejercicio.',
  'Su médico le ha indicado que se ejercite únicamente bajo supervisión médica.',
];

function riskColor(classification: string) {
  if (classification === 'bajo') return 'sage' as const;
  if (classification === 'alto') return 'danger' as const;
  return 'amber' as const;
}

function ParqQuestion({ idx, question, answer, note }: {
  idx: number; question: string; answer: boolean; note?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: `1px solid ${T.borderSoft}` }}>
      <div style={{
        flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
        background: 'rgba(154,5,38,0.06)', border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600, color: T.wine,
      }}>{idx}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textDark, lineHeight: 1.55 }}>
          {question}
        </div>
        {note && (
          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textMed,
            marginTop: 6, fontStyle: 'italic',
            padding: '7px 11px', borderRadius: 8,
            background: 'rgba(154,5,38,0.04)', border: `1px solid rgba(154,5,38,0.10)`,
          }}>"{note}"</div>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {answer && (
          <span style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9A0526',
          }}>Bandera</span>
        )}
        <YesNoToggle value={answer} readonly />
      </div>
    </div>
  );
}

function AssessmentView({ assessment }: { assessment: ParqAssessment }) {
  const answers = [
    assessment.q1_heart_condition,
    assessment.q2_chest_pain,
    assessment.q3_dizziness,
    assessment.q4_chronic_condition,
    assessment.q5_prescribed_medication,
    assessment.q6_bone_joint_problem,
    assessment.q7_medical_supervision,
  ];

  const lastEvalLabel = new Date(assessment.created_at).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div>
      <FormHero
        kicker="Evaluación · Módulo 4"
        title="PAR-Q+"
        lastEval={lastEvalLabel}
        role="cliente"
        score={assessment.yes_count}
        scoreLabel={`${assessment.yes_count} respuestas afirmativas`}
        scoreTone={assessment.yes_count === 0 ? 'sage' : 'amber'}
      />

      <FormSection title="Resultado auto-calculado" columns={3} gap={12}>
        <ComputedCard
          label="Afirmativas"
          value={`${assessment.yes_count} de 7`}
          sub="preguntas"
          tone={assessment.yes_count === 0 ? 'sage' : 'amber'}
        />
        <ComputedCard
          label="Clasificación de riesgo"
          value={assessment.risk_label || assessment.risk_classification}
          tone={riskColor(assessment.risk_classification)}
        />
        <ComputedCard
          label="Estado"
          value="Vigente"
          sub={`Completado: ${lastEvalLabel}`}
          tone="sage"
        />
      </FormSection>

      <div style={{
        background: 'rgba(255,255,255,0.70)', borderRadius: 22,
        border: `1px solid ${T.borderSoft}`, padding: 0, marginBottom: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 22px 12px' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine }}>
            Cuestionario PAR-Q+ (7 preguntas)
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textMed, marginTop: 3 }}>
            Respuestas registradas por el cliente · solo lectura para el entrenador.
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          {QUESTIONS.map((q, i) => (
            <ParqQuestion key={i} idx={i + 1} question={q} answer={answers[i]} />
          ))}
        </div>
      </div>

      {assessment.yes_count > 0 && (
        <div style={{
          background: 'rgba(229,201,122,0.08)', borderRadius: 22,
          border: '1px solid rgba(229,201,122,0.32)', padding: '20px 22px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(229,201,122,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.amberDeep,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600,
                color: T.amberDeep, marginBottom: 3,
              }}>Consideraciones</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textDark, lineHeight: 1.6 }}>
                El cliente marcó {assessment.yes_count} respuesta{assessment.yes_count > 1 ? 's' : ''} afirmativa{assessment.yes_count > 1 ? 's' : ''}. Revisar con el cliente antes de ejercicios de alta intensidad.
              </div>
            </div>
          </div>
        </div>
      )}

      {assessment.additional_notes && (
        <NotesField label="Notas adicionales del cliente" value={assessment.additional_notes} readonly />
      )}
    </div>
  );
}

export default function EvalParqTab({ clientId }: { clientId: number }) {
  const { assessments, loading, fetchClientAssessments } = useParqStore();

  useEffect(() => {
    if (clientId) fetchClientAssessments(clientId);
  }, [clientId, fetchClientAssessments]);

  const latest = assessments[0] ?? null;

  if (loading) return <EvalSpinner />;

  if (!latest) {
    return (
      <>
        <FormHero
          kicker="Evaluación · Módulo 4"
          title="PAR-Q+"
          lastEval={null}
          role="cliente"
        />
        <EvalEmptyState message="Sin cuestionarios PAR-Q+ completados por el cliente." />
      </>
    );
  }

  return <AssessmentView assessment={latest} />;
}
