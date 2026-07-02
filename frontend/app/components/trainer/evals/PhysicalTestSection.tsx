'use client';

import { useEffect, useState } from 'react';
import { usePhysicalTestStore } from '@/lib/stores/physicalTestStore';

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function ResultBadge({ result }: { result: 'passed' | 'failed' }) {
  return result === 'passed' ? (
    <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full bg-kore-sage/20 text-kore-sage-deep">
      Aprobado
    </span>
  ) : (
    <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
      No aprobado
    </span>
  );
}

/**
 * Biweekly credit test registration. A passed test awards credits via the
 * engine (PhysicalTest post_save signal on the backend).
 */
export default function PhysicalTestSection({ clientId }: { clientId: number }) {
  const { tests, loading, submitting, error, fetchTests, createTest } = usePhysicalTestStore();
  const [formOpen, setFormOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [performedAt, setPerformedAt] = useState(todayISO());
  const [result, setResult] = useState<'passed' | 'failed'>('passed');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchTests(clientId);
  }, [clientId, fetchTests]);

  const last = tests[0] ?? null;

  async function handleSave() {
    const created = await createTest(clientId, { performed_at: performedAt, result, notes });
    if (created) {
      setFormOpen(false);
      setNotes('');
      setResult('passed');
      setPerformedAt(todayISO());
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 mb-4 border border-kore-gray-light/40 shadow-sm space-y-3" data-testid="physical-test-section">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50">
            Test quincenal
          </p>
          <p className="text-sm text-kore-gray-dark/80 mt-0.5">
            Aprobarlo otorga créditos al cliente.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="bg-kore-red text-white rounded-xl px-3.5 py-2 text-[12px] font-medium hover:bg-kore-red-dark transition-colors flex-shrink-0"
          >
            Registrar test
          </button>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-3 py-2" role="alert">{error}</p>
      )}

      {formOpen && (
        <div className="rounded-xl border border-kore-gray-light/40 bg-kore-cream/30 p-4 space-y-3" data-testid="physical-test-form">
          <div className="flex flex-wrap gap-3">
            <label className="text-[12px] text-kore-gray-dark/80">
              <span className="block text-[11px] font-semibold text-kore-gray-dark/50 mb-1">Fecha</span>
              <input
                type="date"
                value={performedAt}
                max={todayISO()}
                onChange={(e) => setPerformedAt(e.target.value)}
                className="rounded-xl border border-kore-gray-light/60 bg-white px-3 py-2 text-[13px] text-kore-gray-dark focus:outline-none focus:border-kore-red/40"
              />
            </label>
            <div>
              <span className="block text-[11px] font-semibold text-kore-gray-dark/50 mb-1">Resultado</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setResult('passed')}
                  className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
                    result === 'passed'
                      ? 'bg-kore-sage/25 text-kore-sage-deep'
                      : 'bg-white/60 text-kore-gray-dark/50 border border-white/60'
                  }`}
                >
                  Aprobado
                </button>
                <button
                  type="button"
                  onClick={() => setResult('failed')}
                  className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
                    result === 'failed'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-white/60 text-kore-gray-dark/50 border border-white/60'
                  }`}
                >
                  No aprobado
                </button>
              </div>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas del test (opcional)…"
            className="w-full rounded-xl border border-kore-gray-light/60 bg-white px-3 py-2 text-[13px] text-kore-gray-dark placeholder:text-kore-gray-dark/30 focus:outline-none focus:border-kore-red/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
              className="flex-1 rounded-xl bg-white/60 border border-white/60 py-2 text-[12px] font-semibold text-kore-gray-dark/50 hover:bg-white/80 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 rounded-xl bg-kore-red text-white py-2 text-[12px] font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
            >
              {submitting ? 'Guardando…' : 'Guardar test'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-kore-gray-dark/40">Cargando tests…</p>
      ) : last ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px] text-kore-gray-dark/80">
            <span className="font-semibold">Último test:</span>
            <span>{fmtDate(last.performed_at)}</span>
            <ResultBadge result={last.result} />
          </div>
          {last.notes && <p className="text-xs text-kore-gray-dark/40">{last.notes}</p>}
          {tests.length > 1 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-[11px] font-semibold text-kore-red hover:text-kore-red-dark transition-colors"
            >
              {showHistory ? 'Ocultar historial' : `Ver historial (${tests.length})`}
            </button>
          )}
          {showHistory && (
            <ul className="space-y-1.5">
              {tests.slice(1).map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[12px] text-kore-gray-dark/60">
                  <span>{fmtDate(t.performed_at)}</span>
                  <ResultBadge result={t.result} />
                  {t.notes && <span className="truncate text-kore-gray-dark/40">{t.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-kore-gray-dark/40">
          Sin tests registrados aún. El primero define la línea base del cliente.
        </p>
      )}
    </div>
  );
}
