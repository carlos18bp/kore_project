'use client';

import { useEffect, useRef, useState } from 'react';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';
import { useParqStore } from '@/lib/stores/parqStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import MessageComposerCard from '@/app/components/trainer/MessageComposerCard';
import EmptyState from '@/app/components/shared/EmptyState';

const T = {
  wine:       '#670F22',
  wineDeep:   '#2D0F1A',
  wineDeep2:  '#4A1828',
  ivory:      '#FFF8EC',
  champagne:  '#E7C8A0',
  sage:       '#A8C29C',
  sageDeep:   '#669959',
  amber:      '#E5C97A',
  petal:      '#F4C7C7',
  textDark:   '#2D0F1A',
  textMed:    'rgba(103,15,34,0.55)',
  textSoft:   'rgba(103,15,34,0.35)',
  border:     'rgba(103,15,34,0.08)',
  borderMed:  'rgba(103,15,34,0.15)',
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' · ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Session Objective Card ────────────────────────────────────
function SessionObjectiveCard({ clientId }: { clientId: number }) {
  const { clientSessionsFull, sessionsFullLoading, fetchClientSessionsFull, updateSessionObjective } = useTrainerStore();
  const sessions = clientSessionsFull[clientId] ?? [];
  const next = sessions.find(s => s.status === 'pending' && s.starts_at && new Date(s.starts_at) > new Date()) ?? null;

  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!clientSessionsFull[clientId] && !sessionsFullLoading) fetchClientSessionsFull(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (next) setText(next.session_objective ?? '');
  }, [next?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!next || saving) return;
    setSaving(true);
    await updateSessionObjective(clientId, next.id, text);
    setSaving(false);
    setSaved(true);
    savedRef.current = true;
    setTimeout(() => { setSaved(false); savedRef.current = false; }, 2200);
  }

  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden',
      background: `linear-gradient(135deg, ${T.wineDeep} 0%, ${T.wineDeep2} 55%, #5C2030 100%)`,
      padding: '22px 24px', marginBottom: 20,
      boxShadow: '0 8px 32px -12px rgba(45,15,26,0.40)',
    }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(231,200,160,0.65)', marginBottom: 4 }}>
        Objetivo · próxima sesión
      </div>
      {sessionsFullLoading && !next ? (
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: 'rgba(255,248,236,0.40)', marginTop: 8 }}>Cargando…</div>
      ) : !next ? (
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: 'rgba(255,248,236,0.40)', marginTop: 6 }}>Sin sesiones próximas programadas.</div>
      ) : (
        <>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 600, color: T.ivory, marginBottom: 2 }}>
            {next.package_title}
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(231,200,160,0.60)', marginBottom: 16 }}>
            {formatDateTime(next.starts_at)}
          </div>
          <textarea
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Describe el objetivo de la sesión: ejercicios clave, intensidad, foco…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(231,200,160,0.22)',
              borderRadius: 12, padding: '11px 14px',
              fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.ivory,
              resize: 'vertical', outline: 'none', lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '8px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: saved ? 'rgba(168,194,156,0.28)' : 'rgba(231,200,160,0.18)',
                color: saved ? T.sage : T.champagne,
                transition: 'all 0.2s',
              }}
            >
              {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Module Note Card ──────────────────────────────────────────
type ModuleNoteCardProps = {
  title: string;
  kicker: string;
  evalDate: string | null;
  notes: string;
  onSave: (notes: string) => Promise<void>;
  empty?: boolean;
};

function ModuleNoteCard({ title, kicker, evalDate, notes: initialNotes, onSave, empty }: ModuleNoteCardProps) {
  const [text, setText] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setText(initialNotes); }, [initialNotes]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    await onSave(text);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.70)', borderRadius: 20,
      border: `1px solid ${T.border}`,
      padding: '18px 20px',
    }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: T.textMed, marginBottom: 3 }}>
        {kicker}
      </div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 16, fontWeight: 600, color: T.wine, marginBottom: evalDate ? 2 : 14 }}>
        {title}
      </div>
      {evalDate && (
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft, marginBottom: 12 }}>
          Últ. eval · <strong style={{ color: T.textMed }}>{evalDate}</strong>
        </div>
      )}
      {empty ? (
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textSoft, fontStyle: 'italic', padding: '8px 0' }}>
          Sin evaluaciones registradas aún.
        </div>
      ) : (
        <>
          <textarea
            rows={4}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Notas del entrenador sobre ${title.toLowerCase()}…`}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.80)', border: `1px solid ${T.borderMed}`,
              borderRadius: 10, padding: '10px 12px',
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textDark,
              resize: 'vertical', outline: 'none', lineHeight: 1.6,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: saved ? 'rgba(168,194,156,0.22)' : 'rgba(103,15,34,0.07)',
                color: saved ? T.sageDeep : T.wine,
                transition: 'all 0.2s',
              }}
            >
              {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── NotesTab ─────────────────────────────────────────────────
export default function NotesTab({
  clientId,
  onSendMessage,
  messages,
  messagesLoading,
}: {
  clientId: number;
  onSendMessage: (msg: string, type: 'manual' | 'post_session' | 'post_milestone') => Promise<void>;
  messages: { id: number; message: string; trigger_type: string; seen_by_customer: boolean; created_at: string }[];
  messagesLoading: boolean;
}) {
  const { evaluations: anthropEvals, fetchEvaluations: fetchAnthrop, updateEvaluation: updateAnthrop } = useAnthropometryStore();
  const { evaluations: posturEvals, fetchEvaluations: fetchPostur, updateEvaluation: updatePostur } = usePosturometryStore();
  const { evaluations: fisicaEvals, fetchEvaluations: fetchFisica, updateEvaluation: updateFisica } = usePhysicalEvaluationStore();
  const { assessments: parqList, fetchClientAssessments: fetchParq, updateNotes: updateParq } = useParqStore();

  useEffect(() => {
    fetchAnthrop(clientId);
    fetchPostur(clientId);
    fetchFisica(clientId);
    fetchParq(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const latestAnthrop = anthropEvals[0] ?? null;
  const latestPostur  = posturEvals[0]  ?? null;
  const latestFisica  = fisicaEvals[0]  ?? null;
  const latestParq    = parqList[0]     ?? null;

  const MEAL_LABELS: Record<string, string> = {
    post_session: 'Post sesión', post_milestone: 'Post hito',
  };

  return (
    <div className="space-y-5">
      {/* ── Objetivo de sesión ── */}
      <SessionObjectiveCard clientId={clientId} />

      {/* ── Notas por módulo ── */}
      <div>
        <p style={{
          fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textMed,
          marginBottom: 12,
        }}>Notas por módulo</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <ModuleNoteCard
            title="Antropometría"
            kicker="Módulo 1"
            evalDate={latestAnthrop ? formatDate(latestAnthrop.evaluation_date) : null}
            notes={latestAnthrop?.notes ?? ''}
            empty={!latestAnthrop}
            onSave={async (notes) => {
              if (latestAnthrop) await updateAnthrop(clientId, latestAnthrop.id, { notes });
            }}
          />
          <ModuleNoteCard
            title="Posturometría"
            kicker="Módulo 2"
            evalDate={latestPostur ? formatDate(latestPostur.evaluation_date) : null}
            notes={latestPostur?.notes ?? ''}
            empty={!latestPostur}
            onSave={async (notes) => {
              if (latestPostur) await updatePostur(clientId, latestPostur.id, { notes });
            }}
          />
          <ModuleNoteCard
            title="Evaluación Física"
            kicker="Módulo 3"
            evalDate={latestFisica ? formatDate(latestFisica.evaluation_date) : null}
            notes={latestFisica?.notes ?? ''}
            empty={!latestFisica}
            onSave={async (notes) => {
              if (latestFisica) await updateFisica(clientId, latestFisica.id, { notes });
            }}
          />
          <ModuleNoteCard
            title="PAR-Q+"
            kicker="Módulo 4"
            evalDate={latestParq ? formatDate(latestParq.created_at) : null}
            notes={latestParq?.additional_notes ?? ''}
            empty={!latestParq}
            onSave={async (notes) => {
              if (latestParq) await updateParq(clientId, latestParq.id, notes);
            }}
          />
        </div>
      </div>

      {/* ── Mensajes al cliente ── */}
      <div>
        <p style={{
          fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textMed,
          marginBottom: 12,
        }}>Mensajes al cliente</p>
        <MessageComposerCard onSubmit={onSendMessage} />
        {messagesLoading && messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 border-2 rounded-full" style={{ borderColor: 'rgba(103,15,34,0.15)', borderTopColor: T.wine }} />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState size="sm" title="Sin mensajes enviados" description="Usa el composer de arriba para enviar el primer mensaje." />
        ) : (
          <div className="space-y-2 mt-3">
            {messages.map(msg => {
              const label = MEAL_LABELS[msg.trigger_type] ?? 'Manual';
              const dotColor = msg.trigger_type === 'post_session' ? T.sage : msg.trigger_type === 'post_milestone' ? T.amber : '#9A0526';
              return (
                <div key={msg.id} className="bg-white/65 rounded-[22px] p-4" style={{ border: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: dotColor, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.textMed }}>{label}</span>
                  </div>
                  <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textDark, lineHeight: 1.5 }}>{msg.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft }}>
                      {new Date(msg.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600, color: msg.seen_by_customer ? T.sageDeep : T.textSoft }}>
                      {msg.seen_by_customer ? 'Visto' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
