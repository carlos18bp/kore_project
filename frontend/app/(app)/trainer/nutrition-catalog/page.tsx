'use client';

import { useEffect, useState, useCallback } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  wine:       '#670F22',
  wineDeep:   '#5C2030',
  wineDark:   '#2D0F1A',
  wineDeep2:  '#4A1828',
  ivory:      '#FFF8EC',
  champagne:  '#E7C8A0',
  sage:       '#A8C29C',
  sageDeep:   '#669959',
  sageDark:   '#3F6B36',
  amber:      '#E5C97A',
  amberDeep:  '#A88A2E',
  textDark:   '#2A1A1F',
  textMed:    'rgba(103,15,34,0.65)',
  textSoft:   'rgba(103,15,34,0.55)',
  border:     'rgba(103,15,34,0.10)',
  borderSoft: 'rgba(103,15,34,0.08)',
};

const MEAL_BLOCK_OPTIONS = [
  { value: '',              label: 'Todos los bloques' },
  { value: 'desayuno',     label: 'Desayuno' },
  { value: 'media_manana', label: 'Media mañana' },
  { value: 'almuerzo',     label: 'Almuerzo' },
  { value: 'merienda',     label: 'Merienda' },
  { value: 'cena',         label: 'Cena' },
];

const BLOCK_LABEL: Record<string, string> = {
  desayuno:     'Desayuno',
  media_manana: 'Media mañana',
  almuerzo:     'Almuerzo',
  merienda:     'Merienda',
  cena:         'Cena',
};

const GOAL_OPTIONS = [
  { value: 'fat_loss',       label: 'Pérdida de grasa' },
  { value: 'muscle_gain',    label: 'Ganancia muscular' },
  { value: 'general_health', label: 'Salud general' },
];

const NOVA_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'NOVA 1',   color: T.sageDark },
  2: { label: 'NOVA 1–2', color: T.sageDeep },
  3: { label: 'NOVA 1–3', color: T.amberDeep },
  4: { label: 'NOVA 1–4', color: '#9A0526' },
};

interface MealSuggestion {
  id: number;
  title: string;
  meal_block: string;
  description: string;
  calories_estimate: number;
  nova_max: number;
  goal_tags: string[];
  fitness_level_min: number;
  fitness_level_max: number;
  is_active: boolean;
  created_at: string;
}

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const EMPTY_FORM = {
  title: '',
  meal_block: 'desayuno',
  description: '',
  calories_estimate: '',
  nova_max: 2,
  fitness_level_min: 1,
  fitness_level_max: 5,
  goal_tags: ['general_health'] as string[],
};

const PAGE_SIZE = 15;

// ─── Pill filter ─────────────────────────────────────────────────────────────
function BlockPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 10, border: active ? 'none' : `1px solid ${T.border}`,
      background: active ? T.wine : 'rgba(255,255,255,0.65)',
      color: active ? T.ivory : T.textSoft,
      fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer',
      transition: 'all 120ms',
    }}>
      {label}
    </button>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────
function SuggestionRow({ s }: { s: MealSuggestion }) {
  const nova = NOVA_LABEL[s.nova_max] ?? { label: `NOVA ${s.nova_max}`, color: T.textSoft };
  return (
    <tr style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
      <td style={{ padding: '12px 16px', fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600, color: T.textDark, maxWidth: 240 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
        {s.description && (
          <div style={{ fontSize: 10, color: T.textSoft, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>
        )}
      </td>
      <td style={{ padding: '12px 16px', fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700, color: T.wine, whiteSpace: 'nowrap' }}>
        {BLOCK_LABEL[s.meal_block] ?? s.meal_block}
      </td>
      <td style={{ padding: '12px 16px', fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600, color: T.wine, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {s.calories_estimate} <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, color: T.textSoft, fontWeight: 700 }}>kcal</span>
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, color: nova.color }}>{nova.label}</span>
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textSoft }}>
        {s.fitness_level_min === s.fitness_level_max ? `Nv ${s.fitness_level_min}` : `Nv ${s.fitness_level_min}–${s.fitness_level_max}`}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(s.goal_tags ?? []).map(g => {
            const opt = GOAL_OPTIONS.find(o => o.value === g);
            return (
              <span key={g} style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(168,194,156,0.16)', color: T.sageDark, fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700 }}>
                {opt?.label ?? g}
              </span>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

// ─── Add form ─────────────────────────────────────────────────────────────────
function AddForm({ onCreated }: { onCreated: (s: MealSuggestion) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleGoal = (g: string) => {
    setForm(f => ({
      ...f,
      goal_tags: f.goal_tags.includes(g)
        ? f.goal_tags.filter(t => t !== g)
        : [...f.goal_tags, g],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post<MealSuggestion>(
        '/meal-suggestions/',
        {
          ...form,
          calories_estimate: Number(form.calories_estimate),
        },
        { headers: authHeaders() }
      );
      onCreated(data);
      setForm(EMPTY_FORM);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { detail?: string } } };
      setError(anyErr?.response?.data?.detail ?? 'Error al guardar. Verifica los campos.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 11,
    border: `1px solid ${T.border}`, fontFamily: 'Montserrat, sans-serif',
    fontSize: 13, color: T.textDark, background: 'rgba(255,255,255,0.85)',
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.20em', textTransform: 'uppercase', color: T.textSoft,
    display: 'block', marginBottom: 6,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Title */}
      <div>
        <label style={labelStyle}>Nombre de la comida *</label>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          required
          placeholder="Ej. Avena con frutos rojos y huevos pochados"
          style={inputStyle}
        />
      </div>

      {/* Meal block */}
      <div>
        <label style={labelStyle}>Bloque *</label>
        <select value={form.meal_block} onChange={e => set('meal_block', e.target.value)} style={inputStyle}>
          {MEAL_BLOCK_OPTIONS.filter(o => o.value).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Descripción breve (opcional)</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={2}
          placeholder="Ingredientes principales o preparación..."
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      {/* Calories + NOVA row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Calorías estimadas *</label>
          <input
            type="number"
            min={1}
            value={form.calories_estimate}
            onChange={e => set('calories_estimate', e.target.value)}
            required
            placeholder="480"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>NOVA máx *</label>
          <select value={form.nova_max} onChange={e => set('nova_max', Number(e.target.value))} style={inputStyle}>
            {[1, 2, 3, 4].map(n => (
              <option key={n} value={n}>NOVA {n} {n === 1 ? '(sin procesar)' : n === 2 ? '(procesados culinarios)' : n === 3 ? '(procesados)' : '(ultraprocesados)'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fitness level range */}
      <div>
        <label style={labelStyle}>Nivel de fitness (rango)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <select value={form.fitness_level_min} onChange={e => set('fitness_level_min', Number(e.target.value))} style={inputStyle}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Nivel {n} mín</option>)}
            </select>
          </div>
          <div>
            <select value={form.fitness_level_max} onChange={e => set('fitness_level_max', Number(e.target.value))} style={inputStyle}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Nivel {n} máx</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Goal tags */}
      <div>
        <label style={labelStyle}>Objetivos compatibles</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_OPTIONS.map(g => {
            const active = form.goal_tags.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleGoal(g.value)}
                style={{
                  padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
                  border: active ? 'none' : `1px solid ${T.border}`,
                  background: active ? 'rgba(168,194,156,0.20)' : 'transparent',
                  color: active ? T.sageDark : T.textSoft,
                  transition: 'all 120ms',
                }}>
                {active && '✓ '}{g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(154,5,38,0.08)', border: '1px solid rgba(154,5,38,0.20)', fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: '#9A0526' }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: success ? `linear-gradient(135deg, ${T.sageDeep}, ${T.sageDark})` : `linear-gradient(135deg, ${T.wineDeep}, ${T.wine})`,
          color: T.ivory, fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 18px -8px rgba(45,15,26,0.35)',
          opacity: saving ? 0.7 : 1, transition: 'all 150ms',
        }}>
        {saving ? 'Guardando...' : success ? '✓ Guardada' : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Agregar al catálogo
          </>
        )}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NutritionCatalogPage() {
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async (q: string, block: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pg * PAGE_SIZE), all: '1' });
      if (block) params.set('meal_block', block);
      if (q.trim()) params.set('search', q.trim());
      const { data } = await api.get<{ results: MealSuggestion[]; count: number }>(
        `/meal-suggestions/?${params}`,
        { headers: authHeaders() }
      );
      setSuggestions(data.results);
      setTotal(data.count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(search, blockFilter, page); }, [search, blockFilter, page, fetchData]);

  const handleSearch = (q: string) => { setSearch(q); setPage(0); };
  const handleBlock  = (b: string) => { setBlockFilter(b); setPage(0); };

  const handleCreated = (s: MealSuggestion) => {
    setTotal(t => t + 1);
    if (blockFilter === '' || blockFilter === s.meal_block) {
      setSuggestions(prev => [s, ...prev].slice(0, PAGE_SIZE));
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24">

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 6 }}>
            Catálogo global
          </div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 28, fontWeight: 600, color: T.wine }}>
            Comidas y sugerencias
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textSoft, marginTop: 6 }}>
            Banco global de {total} sugerencias · cualquier trainer puede ampliar este catálogo
          </div>
        </div>

        <div className="xl:grid xl:grid-cols-[1fr_360px] xl:gap-6">

          {/* ── LEFT: table ──────────────────────────────────────────── */}
          <div>
            {/* Search + filters */}
            <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', marginBottom: 16, border: `1px solid ${T.borderSoft}`, boxShadow: '0 2px 12px -8px rgba(45,15,26,0.08)' }}>
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                style={{
                  width: '100%', padding: '11px 16px', borderRadius: 12,
                  border: `1px solid ${T.border}`, fontFamily: 'Montserrat, sans-serif',
                  fontSize: 13, color: T.textDark, outline: 'none',
                  background: 'rgba(255,255,255,0.85)', boxSizing: 'border-box', marginBottom: 14,
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MEAL_BLOCK_OPTIONS.map(o => (
                  <BlockPill key={o.value} label={o.label} active={blockFilter === o.value} onClick={() => handleBlock(o.value)} />
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', border: `1px solid ${T.borderSoft}`, boxShadow: '0 2px 12px -8px rgba(45,15,26,0.08)' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(103,15,34,0.12)', borderTopColor: T.wine, animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : suggestions.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textSoft }}>
                  No se encontraron sugerencias con ese filtro.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}`, background: 'rgba(103,15,34,0.03)' }}>
                        {['Nombre', 'Bloque', 'Kcal', 'NOVA', 'Nivel', 'Objetivos'].map(h => (
                          <th key={h} style={{ padding: '11px 16px', fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: T.textSoft, textAlign: h === 'Kcal' ? 'right' : h === 'NOVA' || h === 'Nivel' ? 'center' : 'left', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {suggestions.map(s => <SuggestionRow key={s.id} s={s} />)}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: `1px solid ${T.borderSoft}` }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textSoft }}>
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '7px 16px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSoft, fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>← Anterior</button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '7px 16px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSoft, fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>Siguiente →</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: add form ───────────────────────────────────────── */}
          <div style={{ marginTop: 0 }} className="mt-5 xl:mt-0">
            <div style={{ background: '#fff', borderRadius: 22, padding: '24px 22px', border: `1px solid ${T.borderSoft}`, boxShadow: '0 2px 12px -8px rgba(45,15,26,0.08)', position: 'sticky', top: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 4 }}>
                  Nueva sugerencia
                </div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 19, fontWeight: 600, color: T.wine }}>
                  Agregar al catálogo
                </div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textSoft, marginTop: 4 }}>
                  Visible para todos los clientes y entrenadores
                </div>
              </div>
              <AddForm onCreated={handleCreated} />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
