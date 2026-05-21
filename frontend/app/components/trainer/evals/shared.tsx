'use client';

import { useRef } from 'react';

// ─── Design tokens ────────────────────────────────────────────
export const T = {
  wine:        '#670F22',
  wineDeep:    '#2D0F1A',
  wineDeep2:   '#4A1828',
  ivory:       '#FFF8EC',
  champagne:   '#E7C8A0',
  crimson:     '#9A0526',
  sage:        '#A8C29C',
  sageDeep:    '#669959',
  amber:       '#E5C97A',
  amberDeep:   '#A88A2E',
  petal:       '#F4C7C7',
  border:      'rgba(103,15,34,0.12)',
  borderSoft:  'rgba(103,15,34,0.06)',
  textDark:    'rgba(45,15,26,0.90)',
  textMed:     'rgba(45,15,26,0.55)',
  textSoft:    'rgba(103,15,34,0.45)',
};

export type Tone = 'sage' | 'amber' | 'danger' | 'wine';

export function toneCfg(tone: Tone) {
  return {
    sage:   { bg: 'rgba(168,194,156,0.14)', bd: 'rgba(168,194,156,0.32)', fg: T.sageDeep,  accent: T.sageDeep },
    amber:  { bg: 'rgba(229,201,122,0.18)', bd: 'rgba(229,201,122,0.40)', fg: T.amberDeep, accent: T.amberDeep },
    danger: { bg: 'rgba(154,5,38,0.10)',    bd: 'rgba(154,5,38,0.25)',    fg: '#9A0526',   accent: '#9A0526' },
    wine:   { bg: 'rgba(154,5,38,0.06)',    bd: 'rgba(154,5,38,0.16)',    fg: T.wine,      accent: T.wine },
  }[tone];
}

// ─── FormHero ─────────────────────────────────────────────────
export function FormHero({
  kicker, title, lastEval, role, score, scoreLabel, scoreTone = 'sage',
}: {
  kicker: string;
  title: string;
  lastEval?: string | null;
  role?: 'trainer' | 'cliente';
  score?: string | number | null;
  scoreLabel?: string;
  scoreTone?: Tone;
}) {
  const toneFg = scoreTone === 'danger' ? T.petal : scoreTone === 'amber' ? '#E5C97A' : T.champagne;
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 22,
      background: `linear-gradient(135deg, ${T.wineDeep} 0%, ${T.wineDeep2} 100%)`,
      padding: '24px 28px', marginBottom: 20,
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -30, width: 220, height: 220,
        borderRadius: '50%', background: `radial-gradient(circle, ${toneFg}22, transparent 70%)`,
        filter: 'blur(20px)',
      }} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6" style={{ position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(231,200,160,0.65)',
            }}>{kicker}</span>
            {role && (
              <span style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                padding: '3px 9px', borderRadius: 999,
                background: role === 'cliente' ? 'rgba(244,199,199,0.18)' : 'rgba(231,200,160,0.14)',
                color: role === 'cliente' ? T.petal : T.champagne,
                border: `1px solid ${role === 'cliente' ? 'rgba(244,199,199,0.30)' : 'rgba(231,200,160,0.30)'}`,
              }}>
                {role === 'cliente' ? 'Completa el cliente' : 'Completa el entrenador'}
              </span>
            )}
          </div>
          <div style={{
            fontFamily: 'Cinzel, serif', fontSize: 26, fontWeight: 600,
            color: T.ivory, marginTop: 6, letterSpacing: '-0.005em',
          }}>{title}</div>
          {lastEval && (
            <div style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 11,
              color: 'rgba(231,200,160,0.70)', marginTop: 8,
            }}>
              Última evaluación · <strong style={{ color: T.ivory, fontWeight: 600 }}>{lastEval}</strong>
            </div>
          )}
          {!lastEval && (
            <div style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 11,
              color: 'rgba(231,200,160,0.45)', marginTop: 8,
            }}>Sin evaluaciones registradas</div>
          )}
        </div>
        {score != null && (
          <div className="text-left sm:text-right" style={{ flexShrink: 0 }}>
            <div style={{
              fontFamily: 'Cinzel, serif', fontSize: 44, fontWeight: 600,
              color: toneFg, lineHeight: 1,
            }}>{score}</div>
            {scoreLabel && (
              <div style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'rgba(231,200,160,0.60)', marginTop: 6,
              }}>{scoreLabel}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FormSection ──────────────────────────────────────────────
const COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
};

export function FormSection({
  title, hint, required, children, columns = 2, gap = 16,
}: {
  title: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  columns?: number;
  gap?: number;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.70)', borderRadius: 22,
      border: `1px solid ${T.borderSoft}`,
      boxShadow: '0 2px 12px -8px rgba(45,15,26,0.08)',
      padding: '22px 24px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine }}>{title}</div>
            {required && (
              <span style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.18em', color: T.crimson, textTransform: 'uppercase',
              }}>· Obligatorio</span>
            )}
          </div>
          {hint && (
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textMed, marginTop: 3 }}>{hint}</div>
          )}
        </div>
      </div>
      <div className={`grid ${COLS_CLASS[columns] ?? COLS_CLASS[2]}`} style={{ gap }}>
        {children}
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────
export function Field({
  label, suffix, value, placeholder, readonly = false, span = 1, hint, onChange,
}: {
  label: string;
  suffix?: string;
  value?: string;
  placeholder?: string;
  readonly?: boolean;
  span?: number;
  hint?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className={span >= 2 ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <label style={{
          fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft,
        }}>{label}</label>
        {hint && <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft }}>{hint}</span>}
      </div>
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        padding: '10px 13px', borderRadius: 11,
        background: readonly ? 'rgba(168,194,156,0.10)' : 'rgba(255,255,255,0.85)',
        border: `1px solid ${readonly ? 'rgba(168,194,156,0.28)' : T.border}`,
      }}>
        <input
          value={value ?? ''}
          placeholder={placeholder}
          readOnly={readonly}
          onChange={e => onChange?.(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600,
            color: readonly ? T.sageDeep : T.wine, minWidth: 0,
          }}
        />
        {suffix && (
          <span style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textSoft, marginLeft: 7,
          }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ─── BilateralPair ────────────────────────────────────────────
export function BilateralPair({
  label, suffix, dR, dL, hint, onChangeR, onChangeL,
}: {
  label: string;
  suffix?: string;
  dR?: string;
  dL?: string;
  hint?: string;
  onChangeR?: (v: string) => void;
  onChangeL?: (v: string) => void;
}) {
  return (
    <div className="col-span-1 sm:col-span-2">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <label style={{
          fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft,
        }}>{label}</label>
        {hint && <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft }}>{hint}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[{ k: 'D', v: dR, cb: onChangeR }, { k: 'I', v: dL, cb: onChangeL }].map(s => (
          <div key={s.k} style={{
            display: 'flex', alignItems: 'center', padding: '9px 11px',
            borderRadius: 11, background: 'rgba(255,255,255,0.85)', border: `1px solid ${T.border}`,
          }}>
            <span style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 8, fontWeight: 700,
              letterSpacing: '0.20em', color: T.textSoft, marginRight: 7, minWidth: 12,
            }}>{s.k}</span>
            <input
              value={s.v ?? ''}
              onChange={e => s.cb?.(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600, color: T.wine, minWidth: 0,
              }}
            />
            {suffix && (
              <span style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textSoft,
              }}>{suffix}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ChipSelect ───────────────────────────────────────────────
export function ChipSelect({
  label, options, value, span = 2, onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  span?: number;
  onChange?: (v: string) => void;
}) {
  return (
    <div className={span >= 2 ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>
      <label style={{
        display: 'block', fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 7,
      }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(o => {
          const sel = o === value;
          return (
            <button
              key={o}
              onClick={() => onChange?.(o)}
              type="button"
              style={{
                padding: '7px 13px', borderRadius: 999,
                background: sel ? 'linear-gradient(135deg, #9A0526, #AB0D2F)' : 'rgba(255,255,255,0.80)',
                color: sel ? '#fff' : T.textDark,
                border: `1px solid ${sel ? 'transparent' : T.border}`,
                fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: sel ? '0 4px 10px -4px rgba(154,5,38,0.35)' : 'none',
              }}
            >{o}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─── RatingScale ──────────────────────────────────────────────
export function RatingScale({
  label, value, max = 5, hint, onChange,
}: {
  label: string;
  value?: number;
  max?: number;
  hint?: string;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="col-span-1 sm:col-span-2">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <label style={{
          fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft,
        }}>{label}</label>
        {hint && <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => {
          const sel = n <= (value ?? 0);
          const cur = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange?.(n)}
              style={{
                flex: 1, padding: '9px 6px', borderRadius: 10,
                background: sel ? 'linear-gradient(135deg, #669959, #3F6B36)' : 'rgba(255,255,255,0.85)',
                color: sel ? '#fff' : T.textMed,
                border: `1px solid ${sel ? 'transparent' : T.border}`,
                fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: cur ? '0 4px 10px -4px rgba(63,107,54,0.45)' : 'none',
              }}
            >{n}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─── YesNoToggle ──────────────────────────────────────────────
export function YesNoToggle({
  value, readonly = false, onChange,
}: {
  value?: boolean;
  readonly?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex', borderRadius: 10,
      background: 'rgba(255,255,255,0.80)', border: `1px solid ${T.border}`,
      padding: 3, gap: 3,
    }}>
      {[{ label: 'Sí', val: true }, { label: 'No', val: false }].map(opt => {
        const sel = opt.val === value;
        return (
          <span
            key={opt.label}
            onClick={() => !readonly && onChange?.(opt.val)}
            style={{
              padding: '6px 16px', borderRadius: 7,
              background: sel
                ? (opt.val ? 'linear-gradient(135deg, #9A0526, #AB0D2F)' : 'linear-gradient(135deg, #669959, #3F6B36)')
                : 'transparent',
              color: sel ? '#fff' : T.textMed,
              fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: readonly ? 'default' : 'pointer',
            }}
          >{opt.label}</span>
        );
      })}
    </div>
  );
}

// ─── ComputedCard ─────────────────────────────────────────────
export function ComputedCard({
  label, value, sub, tone = 'sage',
}: {
  label: string;
  value: string | number | null;
  sub?: string;
  tone?: Tone;
}) {
  const cfg = toneCfg(tone);
  return (
    <div style={{
      padding: '13px 15px', borderRadius: 14,
      background: cfg.bg, border: `1px solid ${cfg.bd}`,
    }}>
      <div style={{
        fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
        letterSpacing: '0.20em', textTransform: 'uppercase', color: T.textSoft,
      }}>{label}</div>
      <div style={{
        fontFamily: 'Cinzel, serif', fontSize: 20, fontWeight: 600,
        color: cfg.fg, marginTop: 5, lineHeight: 1.1,
      }}>{value ?? '—'}</div>
      {sub && (
        <div style={{
          fontFamily: 'Montserrat, sans-serif', fontSize: 10,
          color: cfg.accent, marginTop: 3, fontWeight: 600,
        }}>{sub}</div>
      )}
    </div>
  );
}

// ─── NotesField ───────────────────────────────────────────────
export function NotesField({
  label = 'Notas del entrenador', placeholder, value, readonly = false, onChange,
}: {
  label?: string;
  placeholder?: string;
  value?: string;
  readonly?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.70)', borderRadius: 22,
      border: `1px solid ${T.borderSoft}`,
      padding: '22px 24px', marginBottom: 16,
    }}>
      <label style={{
        display: 'block', fontFamily: 'Cinzel, serif', fontSize: 17,
        fontWeight: 600, color: T.wine, marginBottom: 11,
      }}>{label}</label>
      <textarea
        readOnly={readonly}
        value={value ?? ''}
        placeholder={placeholder}
        rows={3}
        onChange={e => onChange?.(e.target.value)}
        style={{
          width: '100%', padding: '13px 15px', borderRadius: 12,
          background: readonly ? 'rgba(168,194,156,0.08)' : 'rgba(255,255,255,0.85)',
          border: `1px solid ${T.border}`,
          fontFamily: 'Montserrat, sans-serif', fontSize: 13,
          color: T.textDark, outline: 'none', resize: 'vertical', lineHeight: 1.6,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ─── PhotoSlot ────────────────────────────────────────────────
export function PhotoSlot({
  label, currentUrl, onFile,
}: {
  label: string;
  currentUrl?: string | null;
  onFile?: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div style={{
        fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
        letterSpacing: '0.20em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 7,
      }}>{label}</div>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          aspectRatio: '3/4', borderRadius: 14,
          background: currentUrl ? 'transparent' : 'linear-gradient(135deg, rgba(244,199,199,0.10), rgba(231,200,160,0.10))',
          border: `2px dashed ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, cursor: 'pointer', overflow: 'hidden',
        }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.textSoft} strokeWidth="1.4">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="12" cy="12" r="3.5" />
              <path d="M8 5l2-2h4l2 2" />
            </svg>
            <div style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 11,
              color: T.textMed, textAlign: 'center', padding: '0 14px',
            }}>Subir foto · arrastrar o clic</div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile?.(f); }}
      />
    </div>
  );
}

// ─── StickyFooter ─────────────────────────────────────────────
export function StickyFooter({
  lastSaved, onSave, onCancel, saving = false, saveLabel = 'Guardar evaluación',
}: {
  lastSaved?: string;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{
      position: 'sticky', bottom: 20, marginTop: 24,
      padding: '13px 20px', borderRadius: 16,
      background: 'rgba(45,15,26,0.96)', backdropFilter: 'blur(14px)',
      boxShadow: '0 14px 40px -10px rgba(45,15,26,0.40)',
    }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(231,200,160,0.70)' }}>
        {lastSaved
          ? <><strong style={{ color: T.ivory, fontWeight: 600 }}>Último guardado:</strong> {lastSaved}</>
          : <strong style={{ color: T.ivory, fontWeight: 600 }}>Nueva evaluación</strong>}
      </div>
      <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
        <button
          onClick={onCancel}
          type="button"
          style={{
            padding: '9px 16px', borderRadius: 10, background: 'transparent',
            color: 'rgba(231,200,160,0.80)', border: '1px solid rgba(231,200,160,0.28)',
            fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Cancelar</button>
        <button
          onClick={onSave}
          type="button"
          disabled={saving}
          style={{
            padding: '9px 20px', borderRadius: 10,
            background: saving ? 'rgba(168,194,156,0.50)' : 'linear-gradient(135deg, #A8C29C, #669959)',
            color: '#fff', border: 'none',
            fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 16px -6px rgba(168,194,156,0.50)',
          }}>{saving ? 'Guardando…' : saveLabel}</button>
      </div>
    </div>
  );
}

// ─── EvalSectionHeader ────────────────────────────────────────
export function EvalSectionHeader({
  title, hint, onNew,
}: {
  title: string;
  hint?: string;
  onNew?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3" style={{ marginBottom: 16 }}>
      <div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine }}>{title}</div>
        {hint && <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textMed, marginTop: 3 }}>{hint}</div>}
      </div>
      {onNew && (
        <button
          type="button"
          onClick={onNew}
          style={{
            flexShrink: 0, padding: '9px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #670F22, #9A0526)', color: T.ivory,
            fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 12px -4px rgba(154,5,38,0.35)',
          }}>+ Nueva</button>
      )}
    </div>
  );
}

// ─── EvalEmptyState ───────────────────────────────────────────
export function EvalEmptyState({ message, onNew }: { message: string; onNew?: () => void }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.70)', borderRadius: 22,
      border: `1px solid ${T.borderSoft}`, padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textMed, marginBottom: 16 }}>
        {message}
      </div>
      {onNew && (
        <button
          type="button"
          onClick={onNew}
          style={{
            padding: '10px 22px', borderRadius: 12,
            background: 'linear-gradient(135deg, #670F22, #9A0526)', color: T.ivory,
            fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
          }}>Registrar primera evaluación</button>
      )}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────
export function EvalSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(103,15,34,0.12)',
        borderTopColor: '#670F22', animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}
