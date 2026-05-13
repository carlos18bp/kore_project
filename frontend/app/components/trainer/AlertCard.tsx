'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ClientRiskScore, RiskSignal } from '@/lib/stores/trainerStore';
import RiskBadge from './RiskBadge';

type Props = {
  alert: ClientRiskScore;
  onResolve: (id: number) => void;
};

const BORDER_COLOR: Record<string, string> = {
  alto: 'border-l-kore-red',
  medio: 'border-l-amber-400',
  bajo: 'border-l-green-400',
  sin_riesgo: 'border-l-gray-300',
};

const EVAL_MODULE_PATH: Record<string, { path: string; label: string }> = {
  anthropometry: { path: 'anthropometry', label: 'Antropometría' },
  posturometry: { path: 'posturometry', label: 'Posturometría' },
  physical: { path: 'physical-evaluation', label: 'Evaluación física' },
  parq: { path: 'parq', label: 'PAR-Q+' },
  nutrition: { path: 'nutrition', label: 'Nutrición' },
};

function SignalRow({ signal }: { signal: RiskSignal }) {
  const [expanded, setExpanded] = useState(false);
  const severityDot = signal.severity === 'alto'
    ? 'bg-kore-red'
    : signal.severity === 'medio'
    ? 'bg-amber-400'
    : 'bg-green-400';

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot}`} />
        <span className="text-sm text-kore-gray-dark/80 flex-1">{signal.label}</span>
        <svg
          className={`w-4 h-4 text-kore-gray-dark/30 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <p className="ml-4 text-xs text-kore-gray-dark/50 leading-relaxed">{signal.detail}</p>
      )}
    </div>
  );
}

function pickEvalModule(signals: RiskSignal[]): { path: string; label: string } | null {
  // Prefer the signal with the highest severity that has a known module
  const order = { alto: 0, medio: 1, bajo: 2 } as const;
  const sorted = [...signals]
    .filter((s) => s.module && EVAL_MODULE_PATH[s.module])
    .sort((a, b) => order[a.severity] - order[b.severity]);
  if (sorted.length === 0) return null;
  return EVAL_MODULE_PATH[sorted[0].module as string] ?? null;
}

export default function AlertCard({ alert, onResolve }: Props) {
  const borderColor = BORDER_COLOR[alert.level] ?? BORDER_COLOR.sin_riesgo;
  const allSignals = [...alert.behavioral_signals, ...alert.clinical_signals];
  const evalModule = pickEvalModule(allSignals);
  const initials = alert.customer_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm border-l-4 ${borderColor} overflow-hidden`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-kore-red">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-kore-gray-dark truncate">{alert.customer_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <RiskBadge level={alert.level} size="sm" />
              <span className="text-xs text-kore-gray-dark/40">
                {allSignals.length} señal{allSignals.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>
          <span className="text-xs text-kore-gray-dark/30 flex-shrink-0">
            {new Date(alert.computed_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
          </span>
        </div>

        {/* Signals */}
        {allSignals.length > 0 && (
          <div className="space-y-2 pl-1">
            {allSignals.map((signal, i) => (
              <SignalRow key={`${signal.type}-${i}`} signal={signal} />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onResolve(alert.id)}
            className="w-full py-2 rounded-xl bg-kore-red/10 text-kore-red text-sm font-medium active:scale-95 transition-transform duration-100"
          >
            Resolver alerta
          </button>
          {evalModule && (
            <Link
              href={`/trainer/clients/client/${evalModule.path}?id=${alert.customer_id}&from=alert&alertId=${alert.id}`}
              prefetch={false}
              className="w-full py-2 rounded-xl bg-kore-gray-dark/[0.04] text-kore-gray-dark/70 text-sm font-medium active:scale-95 transition-transform duration-100 inline-flex items-center justify-center gap-1.5 hover:bg-kore-gray-dark/[0.08]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Crear evaluación de {evalModule.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
