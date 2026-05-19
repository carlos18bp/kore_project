'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';
import { useParqStore } from '@/lib/stores/parqStore';
import { useNutritionStore } from '@/lib/stores/nutritionStore';
import { useTrainerStore, type ClientSession, type ClientMonthlyProgram, type ClientWeeklyPlan, type TrainerMessageItem } from '@/lib/stores/trainerStore';
import type { NutritionHabit } from '@/lib/stores/nutritionStore';
import MessageComposerCard from '@/app/components/trainer/MessageComposerCard';
import SessionMiniCalendar from '@/app/components/trainer/SessionMiniCalendar';
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
  textDark:   '#2D0F1A',
  textMed:    'rgba(103,15,34,0.55)',
  textSoft:   'rgba(103,15,34,0.35)',
  border:     'rgba(103,15,34,0.08)',
  borderMed:  'rgba(103,15,34,0.15)',
};

// ─── Date helpers ────────────────────────────────────────────
function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateShort(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
function formatDateLong(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return '';
  return `${formatDateShort(start)} → ${formatDateShort(end)}`;
}

// ─── Shared styles ───────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textMed,
};
// Tailwind class for the standard row: 1 col mobile, 2 tablet, 4 desktop
const GRID_CLASS = 'grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4';

// ─── Composer (col 1) ────────────────────────────────────────
type ComposerProps = {
  kicker?: string;
  title: string;
  meta?: string;
  notes: string;
  placeholder?: string;
  rows?: number;
  onSave: (notes: string) => Promise<void>;
};
function Composer({ kicker, title, meta, notes: initial, placeholder, rows = 5, onSave }: ComposerProps) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSavedNote = !!(initial && initial.trim());
  const [mode, setMode] = useState<'view' | 'edit'>(hasSavedNote ? 'view' : 'edit');
  const viewRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  // Sync local text with incoming initial whenever it changes
  useEffect(() => { setText(initial); }, [initial]);

  // Switch mode automatically when initial changes (selecting a different item)
  useEffect(() => {
    setMode(initial && initial.trim() ? 'view' : 'edit');
  }, [initial]);

  // GSAP transition between view and edit modes
  useEffect(() => {
    const target = mode === 'view' ? viewRef.current : editRef.current;
    if (!target) return;
    gsap.fromTo(
      target,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' },
    );
  }, [mode]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(text);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      if (text && text.trim()) setMode('view');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting || !initial) return;
    if (!window.confirm('¿Eliminar esta nota? Se borrará el contenido guardado.')) return;
    setDeleting(true);
    setError(null);
    try {
      await onSave('');
      setText('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      setMode('edit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{
      background: `linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))`,
      borderRadius: 18,
      border: `1px solid ${T.borderMed}`,
      padding: '16px 18px',
      boxShadow: '0 6px 18px -10px rgba(45,15,26,0.18)',
    }}>
      {kicker && (
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textMed, marginBottom: 3 }}>
          {kicker}
        </div>
      )}
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600, color: T.wine, marginBottom: meta ? 2 : 10 }}>
        {title}
      </div>
      {meta && (
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft, marginBottom: 10 }}>
          {meta}
        </div>
      )}
      <div style={{ position: 'relative', minHeight: 120 }}>
        {mode === 'view' ? (
          <div ref={viewRef} style={{ position: 'relative' }}>
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(168,194,156,0.10)', border: '1px solid rgba(168,194,156,0.30)',
            }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12.5, color: T.textDark, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {initial}
              </p>
            </div>
            {error && (
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: '#9A0526', marginTop: 8, marginBottom: 0 }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(154,5,38,0.20)',
                  background: 'transparent', color: '#9A0526',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {deleting ? 'Eliminando…' : 'Eliminar nota'}
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                style={{
                  fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: 'rgba(103,15,34,0.08)', color: T.wine,
                  transition: 'all 0.2s',
                }}
              >
                Editar nota
              </button>
            </div>
          </div>
        ) : (
          <div ref={editRef}>
            <textarea
              rows={rows}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={placeholder ?? 'Escribe la nota del entrenador…'}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.85)', border: `1px solid ${T.borderMed}`,
                borderRadius: 10, padding: '10px 12px',
                fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textDark,
                resize: 'vertical', outline: 'none', lineHeight: 1.55,
              }}
            />
            {error && (
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: '#9A0526', marginTop: 8, marginBottom: 0 }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              {hasSavedNote ? (
                <button
                  type="button"
                  onClick={() => { setText(initial); setMode('view'); }}
                  disabled={saving || deleting}
                  style={{
                    fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(103,15,34,0.15)',
                    background: 'transparent', color: T.textMed,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  Cancelar
                </button>
              ) : <span />}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || deleting}
                style={{
                  fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: saved ? 'rgba(168,194,156,0.22)' : 'rgba(103,15,34,0.08)',
                  color: saved ? T.sageDeep : T.wine,
                  transition: 'all 0.2s',
                }}
              >
                {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History card (cols 2-4) ─────────────────────────────────
type HistoryCardProps = {
  kicker: string;
  title: string;
  meta?: string;
  snippet: string;
  onClick?: () => void;
  onDelete?: () => Promise<void>;
  active?: boolean;
};
function HistoryCard({ kicker, title, meta, snippet, onClick, onDelete, active }: HistoryCardProps) {
  const clickable = !!onClick;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDelete || deleting) return;
    if (!window.confirm('¿Eliminar esta nota? Se borrará el contenido guardado.')) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        style={{
          background: active ? 'rgba(103,15,34,0.05)' : 'rgba(255,255,255,0.55)',
          borderRadius: 18,
          border: `1px solid ${active ? T.borderMed : T.border}`,
          padding: '14px 16px',
          textAlign: 'left',
          cursor: clickable ? 'pointer' : 'default',
          transition: 'all 0.2s',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textMed, marginBottom: 3, paddingRight: onDelete && snippet ? 22 : 0 }}>
          {kicker}
        </div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 600, color: T.wine, marginBottom: meta ? 2 : 8 }}>
          {title}
        </div>
        {meta && (
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft, marginBottom: 8 }}>
            {meta}
          </div>
        )}
        {snippet ? (
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textDark, lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {snippet}
          </p>
        ) : (
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textSoft, fontStyle: 'italic', margin: 0 }}>
            Sin nota.
          </p>
        )}
      </button>

      {onDelete && snippet && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Eliminar nota"
          title="Eliminar nota"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 24, height: 24, borderRadius: 999, border: 'none',
            background: 'rgba(154,5,38,0.08)', color: '#9A0526',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 700, lineHeight: 1,
            transition: 'background 0.2s',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Section with composer + paginated history ──────────────
type PaginatedSectionProps<T extends { id: number }> = {
  sectionLabel: string;
  items: T[];
  initialSelectedId?: number | null;
  renderComposer: (item: T) => ReactNode;
  renderHistory: (item: T, onSelect: () => void) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
};
function PaginatedSection<T extends { id: number }>({
  sectionLabel, items, initialSelectedId,
  renderComposer, renderHistory, emptyTitle, emptyDescription,
}: PaginatedSectionProps<T>) {
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId ?? null);
  const [extraRows, setExtraRows] = useState(0);

  useEffect(() => {
    if (items.length > 0 && selectedId === null) setSelectedId(items[0].id);
  }, [items, selectedId]);

  const selected = items.find(i => i.id === selectedId) ?? null;
  const history = items.filter(i => i.id !== selectedId);

  const FIRST_ROW = 3;
  const EXTRA_ROW = 4;

  const firstRow = history.slice(0, FIRST_ROW);
  const additionalRows: T[][] = [];
  let cursor = FIRST_ROW;
  for (let r = 0; r < extraRows; r++) {
    additionalRows.push(history.slice(cursor, cursor + EXTRA_ROW));
    cursor += EXTRA_ROW;
  }
  const remaining = Math.max(0, history.length - cursor);

  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <p style={labelStyle}>{sectionLabel}</p>
        <EmptyState
          title={emptyTitle ?? 'Sin registros'}
          description={emptyDescription ?? 'Cuando haya datos disponibles aparecerán aquí.'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p style={labelStyle}>{sectionLabel}</p>

      <div className={GRID_CLASS}>
        {selected && renderComposer(selected)}
        {firstRow.map(item => renderHistory(item, () => { setSelectedId(item.id); setExtraRows(0); }))}
      </div>

      {additionalRows.map((row, idx) => (
        <div key={idx} className={GRID_CLASS}>
          {row.map(item => renderHistory(item, () => { setSelectedId(item.id); setExtraRows(0); }))}
        </div>
      ))}

      {remaining > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
          <button
            onClick={() => setExtraRows(extraRows + 1)}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              padding: '8px 18px', borderRadius: 999,
              background: 'rgba(255,255,255,0.70)', border: `1px solid ${T.borderMed}`,
              color: T.wine, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            Ver historial anterior ({remaining})
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sesiones ────────────────────────────────────────────────
function SesionesSection({
  clientId, onSendMessage, messages, messagesLoading,
}: {
  clientId: number;
  onSendMessage: (msg: string, type: 'manual' | 'post_session' | 'post_milestone') => Promise<void>;
  messages: { id: number; message: string; trigger_type: string; seen_by_customer: boolean; created_at: string }[];
  messagesLoading: boolean;
}) {
  const { clientSessionsFull, sessionsFullLoading, fetchClientSessionsFull, updateSessionObjective } = useTrainerStore();
  const sessions = clientSessionsFull[clientId] ?? [];

  useEffect(() => {
    if (!clientSessionsFull[clientId] && !sessionsFullLoading) fetchClientSessionsFull(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = useMemo(() =>
    sessions
      .filter(s => s.status === 'pending' && s.starts_at && new Date(s.starts_at) > new Date())
      .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime()),
    [sessions],
  );

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  useEffect(() => {
    if (upcoming.length > 0 && selectedSessionId === null) setSelectedSessionId(upcoming[0].id);
  }, [upcoming, selectedSessionId]);

  const selected = upcoming.find(s => s.id === selectedSessionId) ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p style={labelStyle}>Objetivo por sesión próxima</p>

        {upcoming.length === 0 ? (
          <EmptyState
            title="Sin próximas sesiones"
            description="Cuando el cliente agende una nueva sesión, podrás dejar el objetivo aquí."
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {/* Mini-calendario (izquierda) */}
            <div>
              <SessionMiniCalendar
                sessions={upcoming}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
              />
            </div>

            {/* Composer (derecha) */}
            <div>
              {selected ? (
                <Composer
                  kicker={`Sesión activa · ${selected.package_title}`}
                  title={formatDateLong(selected.starts_at)}
                  meta="Objetivo de la sesión"
                  notes={selected.session_objective ?? ''}
                  placeholder="Ejercicios clave, intensidad, foco de esta sesión…"
                  rows={8}
                  onSave={async (notes) => { await updateSessionObjective(clientId, selected.id, notes); }}
                />
              ) : (
                <EmptyState size="sm" title="Selecciona una sesión" description="Toca un día con sesión en el calendario para editar su objetivo." />
              )}
            </div>
          </div>
        )}
      </div>

      <MessagesSection
        clientId={clientId}
        onSendMessage={onSendMessage}
        messages={messages}
        loading={messagesLoading}
      />
    </div>
  );
}

// ─── Mensaje editable (history card del bloque Mensajes) ─────
type MessageCardProps = {
  message: { id: number; message: string; trigger_type: string; seen_by_customer: boolean; created_at: string };
  triggerLabel: string;
  onUpdate: (newText: string) => Promise<void>;
  onDelete: () => Promise<void>;
};
function EditableMessageCard({ message, triggerLabel, onUpdate, onDelete }: MessageCardProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.message);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setText(message.message); }, [message.message]);

  const dotColor = message.trigger_type === 'post_session' ? T.sage : message.trigger_type === 'post_milestone' ? T.amber : '#9A0526';

  async function handleSave() {
    if (saving || !text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate(text.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    if (!window.confirm('¿Eliminar este mensaje? El cliente dejará de verlo en su app.')) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.');
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white/65 rounded-[22px] p-4" style={{ border: `1px solid ${T.border}`, position: 'relative' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ width: 6, height: 6, borderRadius: 3, background: dotColor, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.textMed }}>
          {triggerLabel}
        </span>
      </div>

      {editing ? (
        <>
          <textarea
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.90)', border: `1px solid ${T.borderMed}`,
              borderRadius: 10, padding: '8px 10px',
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textDark,
              resize: 'vertical', outline: 'none', lineHeight: 1.55,
            }}
          />
          {error && (
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: '#9A0526', marginTop: 6, marginBottom: 0 }}>
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => { setText(message.message); setEditing(false); setError(null); }}
              disabled={saving}
              style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '5px 12px', borderRadius: 999, border: `1px solid rgba(103,15,34,0.15)`,
                background: 'transparent', color: T.textMed, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !text.trim()}
              style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '5px 14px', borderRadius: 999, border: 'none',
                background: 'rgba(103,15,34,0.08)', color: T.wine, cursor: 'pointer',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textDark, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
            {message.message}
          </p>
          {error && (
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: '#9A0526', marginTop: 6, marginBottom: 0 }}>
              {error}
            </p>
          )}
          <div className="flex items-center justify-between mt-2 gap-2">
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft }}>
              {new Date(message.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600, color: message.seen_by_customer ? T.sageDeep : T.textSoft }}>
                {message.seen_by_customer ? '✓ Visto' : 'Pendiente'}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Editar mensaje"
                title="Editar"
                style={{
                  width: 24, height: 24, borderRadius: 999, border: 'none',
                  background: 'rgba(103,15,34,0.06)', color: T.wine,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
                }}
              >
                ✎
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Eliminar mensaje"
                title="Eliminar"
                style={{
                  width: 24, height: 24, borderRadius: 999, border: 'none',
                  background: 'rgba(154,5,38,0.08)', color: '#9A0526',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 700, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Mensajes (sin selección, solo composer + historial) ─────
function MessagesSection({
  clientId, onSendMessage, messages, loading,
}: {
  clientId: number;
  onSendMessage: (msg: string, type: 'manual' | 'post_session' | 'post_milestone') => Promise<void>;
  messages: { id: number; message: string; trigger_type: string; seen_by_customer: boolean; created_at: string }[];
  loading: boolean;
}) {
  const { updateTrainerMessage, deleteTrainerMessage } = useTrainerStore();
  const [extraRows, setExtraRows] = useState(0);
  const FIRST_ROW = 3;
  const EXTRA_ROW = 4;

  const firstRow = messages.slice(0, FIRST_ROW);
  const additionalRows: typeof messages[] = [];
  let cursor = FIRST_ROW;
  for (let r = 0; r < extraRows; r++) {
    additionalRows.push(messages.slice(cursor, cursor + EXTRA_ROW));
    cursor += EXTRA_ROW;
  }
  const remaining = Math.max(0, messages.length - cursor);

  const TRIGGER_LABELS: Record<string, string> = {
    manual: 'Manual', post_session: 'Post sesión', post_milestone: 'Post hito',
  };

  return (
    <div className="space-y-3">
      <p style={labelStyle}>Mensajes al cliente</p>

      <div className={GRID_CLASS}>
        <div>
          <MessageComposerCard onSubmit={onSendMessage} />
        </div>
        {loading && messages.length === 0 ? (
          <Spinner />
        ) : firstRow.length === 0 ? (
          <div className="md:col-span-1 xl:col-span-3">
            <EmptyState size="sm" title="Sin mensajes enviados" description="Usa el composer para enviar el primer mensaje." />
          </div>
        ) : (
          firstRow.map(m => (
            <EditableMessageCard
              key={m.id}
              message={m}
              triggerLabel={TRIGGER_LABELS[m.trigger_type] ?? 'Manual'}
              onUpdate={(newText) => updateTrainerMessage(clientId, m.id, newText)}
              onDelete={() => deleteTrainerMessage(clientId, m.id)}
            />
          ))
        )}
      </div>

      {additionalRows.map((row, idx) => (
        <div key={idx} className={GRID_CLASS}>
          {row.map(m => (
            <EditableMessageCard
              key={m.id}
              message={m}
              triggerLabel={TRIGGER_LABELS[m.trigger_type] ?? 'Manual'}
              onUpdate={(newText) => updateTrainerMessage(clientId, m.id, newText)}
              onDelete={() => deleteTrainerMessage(clientId, m.id)}
            />
          ))}
        </div>
      ))}

      {remaining > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
          <button
            onClick={() => setExtraRows(extraRows + 1)}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              padding: '8px 18px', borderRadius: 999,
              background: 'rgba(255,255,255,0.70)', border: `1px solid ${T.borderMed}`,
              color: T.wine, cursor: 'pointer',
            }}
          >
            Ver mensajes anteriores ({remaining})
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Programa ────────────────────────────────────────────────
function ProgramaSection({ clientId }: { clientId: number }) {
  const { clientMonthlyPrograms, monthlyProgramsLoading, fetchClientMonthlyPrograms, updateMonthlyProgramNote } = useTrainerStore();
  const programs = clientMonthlyPrograms[clientId] ?? [];

  useEffect(() => {
    if (!clientMonthlyPrograms[clientId] && !monthlyProgramsLoading) fetchClientMonthlyPrograms(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (monthlyProgramsLoading && programs.length === 0) return <Spinner />;

  return (
    <PaginatedSection<ClientMonthlyProgram>
      sectionLabel="Ciclos de 28 días"
      items={programs}
      renderComposer={(p) => (
        <Composer
          kicker={`Estado: ${p.status}${p.is_paused ? ' · pausado' : ''}`}
          title="Notas del programa"
          meta={`${formatDateRange(p.start_date, p.end_date)} · objetivo: ${p.goal}`}
          notes={p.trainer_notes ?? ''}
          placeholder="Observaciones del entrenador para este ciclo de 28 días…"
          rows={6}
          onSave={async (notes) => { await updateMonthlyProgramNote(clientId, p.id, notes); }}
        />
      )}
      renderHistory={(p, onSelect) => (
        <HistoryCard
          key={p.id}
          kicker={p.status}
          title={formatDateRange(p.start_date, p.end_date)}
          meta={`Objetivo: ${p.goal}`}
          snippet={p.trainer_notes ?? ''}
          onClick={onSelect}
          onDelete={async () => { await updateMonthlyProgramNote(clientId, p.id, ''); }}
        />
      )}
      emptyTitle="Sin programas de entrenamiento"
      emptyDescription="Cuando se genere el primer programa de 28 días, aparecerá aquí."
    />
  );
}

// ─── Nutrición ───────────────────────────────────────────────
function NutricionSection({ clientId }: { clientId: number }) {
  const { clientWeeklyPlans, weeklyPlansLoading, fetchClientWeeklyPlans, updateWeeklyPlanNote } = useTrainerStore();
  const { entries: habits, fetchClientEntries: fetchHabits, approveEntry } = useNutritionStore();
  const plans = clientWeeklyPlans[clientId] ?? [];

  useEffect(() => {
    if (!clientWeeklyPlans[clientId] && !weeklyPlansLoading) fetchClientWeeklyPlans(clientId);
    fetchHabits(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {weeklyPlansLoading && plans.length === 0 ? (
        <Spinner />
      ) : (
        <PaginatedSection<ClientWeeklyPlan>
          sectionLabel="Planes semanales (ciclo 28 días = 4 semanas)"
          items={plans}
          renderComposer={(p) => (
            <Composer
              kicker={`Semana · ${p.status}`}
              title={`Plan ${formatDate(p.week_start)}`}
              meta={formatDateRange(p.week_start, p.week_end)}
              notes={p.trainer_notes ?? ''}
              placeholder="Observaciones sobre esta semana nutricional…"
              rows={5}
              onSave={async (notes) => { await updateWeeklyPlanNote(clientId, p.id, notes); }}
            />
          )}
          renderHistory={(p, onSelect) => (
            <HistoryCard
              key={p.id}
              kicker={p.status}
              title={formatDateRange(p.week_start, p.week_end)}
              meta={`Objetivo: ${p.goal}`}
              snippet={p.trainer_notes ?? ''}
              onClick={onSelect}
              onDelete={async () => { await updateWeeklyPlanNote(clientId, p.id, ''); }}
            />
          )}
          emptyTitle="Sin planes nutricionales"
          emptyDescription="Cuando se generen los planes semanales del cliente, aparecerán aquí."
        />
      )}

      <PaginatedSection<NutritionHabit>
        sectionLabel="Evaluación de hábitos nutricionales"
        items={habits}
        renderComposer={(h) => (
          <Composer
            kicker={h.trainer_approved_at ? '✓ Aprobada' : 'Pendiente de aprobación'}
            title="Hábitos del cliente"
            meta={`Registrada el ${formatDate(h.created_at)}`}
            notes={h.trainer_notes ?? ''}
            placeholder="Notas y observaciones sobre los hábitos del cliente…"
            rows={5}
            onSave={async (notes) => { await approveEntry(clientId, h.id, notes); }}
          />
        )}
        renderHistory={(h, onSelect) => (
          <HistoryCard
            key={h.id}
            kicker={h.trainer_approved_at ? '✓ Aprobada' : 'Pendiente'}
            title={formatDate(h.created_at)}
            meta={h.habit_category ? `Score · ${h.habit_category}` : undefined}
            snippet={h.trainer_notes ?? ''}
            onClick={onSelect}
            onDelete={async () => { await approveEntry(clientId, h.id, ''); }}
          />
        )}
        emptyTitle="Sin registros de hábitos"
        emptyDescription="El cliente aún no ha registrado sus hábitos nutricionales."
      />
    </div>
  );
}

// ─── Evaluaciones (4 filas: antrop / postur / física / parq) ──
type EvalLike = { id: number; evaluation_date?: string; created_at?: string; notes?: string; additional_notes?: string };

function EvaluacionesSection({ clientId }: { clientId: number }) {
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

  return (
    <div className="space-y-6">
      <PaginatedSection<EvalLike>
        sectionLabel="Antropometría · Módulo 1"
        items={anthropEvals}
        renderComposer={(e) => (
          <Composer
            kicker="Última evaluación"
            title="Antropometría"
            meta={`Eval. del ${formatDate(e.evaluation_date)}`}
            notes={e.notes ?? ''}
            placeholder="Notas generales del entrenador sobre la antropometría…"
            rows={5}
            onSave={async (notes) => { await updateAnthrop(clientId, e.id, { notes }); }}
          />
        )}
        renderHistory={(e, onSelect) => (
          <HistoryCard
            key={e.id}
            kicker="Evaluación"
            title={formatDate(e.evaluation_date)}
            snippet={e.notes ?? ''}
            onClick={onSelect}
            onDelete={async () => { await updateAnthrop(clientId, e.id, { notes: '' }); }}
          />
        )}
        emptyTitle="Sin evaluaciones antropométricas"
        emptyDescription="Cuando se cree la primera evaluación antropométrica aparecerá aquí."
      />

      <PaginatedSection<EvalLike>
        sectionLabel="Posturometría · Módulo 2"
        items={posturEvals}
        renderComposer={(e) => (
          <Composer
            kicker="Última evaluación"
            title="Posturometría"
            meta={`Eval. del ${formatDate(e.evaluation_date)}`}
            notes={e.notes ?? ''}
            placeholder="Nota general (las observaciones por vista viven en su módulo)…"
            rows={5}
            onSave={async (notes) => { await updatePostur(clientId, e.id, { notes }); }}
          />
        )}
        renderHistory={(e, onSelect) => (
          <HistoryCard
            key={e.id}
            kicker="Evaluación"
            title={formatDate(e.evaluation_date)}
            snippet={e.notes ?? ''}
            onClick={onSelect}
            onDelete={async () => { await updatePostur(clientId, e.id, { notes: '' }); }}
          />
        )}
        emptyTitle="Sin evaluaciones posturales"
        emptyDescription="Cuando se cree la primera evaluación postural aparecerá aquí."
      />

      <PaginatedSection<EvalLike>
        sectionLabel="Evaluación física · Módulo 3"
        items={fisicaEvals}
        renderComposer={(e) => (
          <Composer
            kicker="Última evaluación"
            title="Evaluación física"
            meta={`Eval. del ${formatDate(e.evaluation_date)}`}
            notes={e.notes ?? ''}
            placeholder="Nota general (las notas por test viven en su módulo)…"
            rows={5}
            onSave={async (notes) => { await updateFisica(clientId, e.id, { notes }); }}
          />
        )}
        renderHistory={(e, onSelect) => (
          <HistoryCard
            key={e.id}
            kicker="Evaluación"
            title={formatDate(e.evaluation_date)}
            snippet={e.notes ?? ''}
            onClick={onSelect}
            onDelete={async () => { await updateFisica(clientId, e.id, { notes: '' }); }}
          />
        )}
        emptyTitle="Sin evaluaciones físicas"
        emptyDescription="Cuando se cree la primera evaluación física aparecerá aquí."
      />

      <PaginatedSection<EvalLike>
        sectionLabel="PAR-Q+ · Módulo 4"
        items={parqList}
        renderComposer={(p) => (
          <Composer
            kicker="Último registro"
            title="PAR-Q+"
            meta={`Registrada el ${formatDate(p.created_at)}`}
            notes={p.additional_notes ?? ''}
            placeholder="Notas adicionales sobre el PAR-Q+…"
            rows={5}
            onSave={async (notes) => { await updateParq(clientId, p.id, notes); }}
          />
        )}
        renderHistory={(p, onSelect) => (
          <HistoryCard
            key={p.id}
            kicker="Registro"
            title={formatDate(p.created_at)}
            snippet={p.additional_notes ?? ''}
            onClick={onSelect}
            onDelete={async () => { await updateParq(clientId, p.id, ''); }}
          />
        )}
        emptyTitle="Sin registros PAR-Q+"
        emptyDescription="Cuando el cliente complete el PAR-Q+ aparecerá aquí."
      />
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="animate-spin h-6 w-6 border-2 rounded-full"
        style={{ borderColor: 'rgba(103,15,34,0.15)', borderTopColor: T.wine }} />
    </div>
  );
}

// ─── NotesTab (root with sub-tabs) ───────────────────────────
type SubTabId = 'sesiones' | 'programa' | 'nutricion' | 'evaluaciones';

const SUB_TABS: { id: SubTabId; label: string }[] = [
  { id: 'sesiones',     label: 'Sesiones' },
  { id: 'programa',     label: 'Programa' },
  { id: 'nutricion',    label: 'Nutrición' },
  { id: 'evaluaciones', label: 'Evaluaciones' },
];

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
  const [active, setActive] = useState<SubTabId>('sesiones');

  return (
    <div className="space-y-4">
      {/* Sub-tab nav */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {SUB_TABS.map(t => {
          const isActive = t.id === active;
          return (
            <button key={t.id} onClick={() => setActive(t.id)}
              style={{
                flexShrink: 0,
                padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: isActive ? T.wine : 'rgba(255,255,255,0.70)',
                color: isActive ? T.ivory : T.textMed,
                fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.08em',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 6px 18px -8px rgba(45,15,26,0.4)' : 'none',
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        {active === 'sesiones'     && <SesionesSection clientId={clientId} onSendMessage={onSendMessage} messages={messages} messagesLoading={messagesLoading} />}
        {active === 'programa'     && <ProgramaSection clientId={clientId} />}
        {active === 'nutricion'    && <NutricionSection clientId={clientId} />}
        {active === 'evaluaciones' && <EvaluacionesSection clientId={clientId} />}
      </div>
    </div>
  );
}
