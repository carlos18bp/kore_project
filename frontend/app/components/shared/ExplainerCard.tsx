import { ReactNode } from 'react';
import SectionLabel from './SectionLabel';

type Tone = 'neutral' | 'positive' | 'warning' | 'danger';

type Props = {
  title?: string;
  whatIs?: ReactNode;
  importance?: ReactNode;
  nextStep?: ReactNode;
  tone?: Tone;
  className?: string;
};

const TONE_BORDER: Record<Tone, string> = {
  neutral: 'border-white/60',
  positive: 'border-emerald-200/70',
  warning: 'border-amber-200/70',
  danger: 'border-rose-200/70',
};

const TONE_LEFT_BAR: Record<Tone, string> = {
  neutral: '',
  positive: 'border-l-4 border-l-emerald-400',
  warning: 'border-l-4 border-l-amber-400',
  danger: 'border-l-4 border-l-kore-red',
};

export default function ExplainerCard({
  title,
  whatIs,
  importance,
  nextStep,
  tone = 'neutral',
  className = '',
}: Props) {
  return (
    <div
      className={`bg-white/70 backdrop-blur-sm rounded-2xl border ${TONE_BORDER[tone]} ${TONE_LEFT_BAR[tone]} shadow-sm p-4 space-y-3 ${className}`}
    >
      {title && (
        <p className="font-heading text-base font-semibold text-kore-gray-dark leading-snug">
          {title}
        </p>
      )}
      {whatIs && (
        <div>
          <SectionLabel className="mb-1">Qué es</SectionLabel>
          <p className="text-sm text-kore-gray-dark/80 leading-relaxed">{whatIs}</p>
        </div>
      )}
      {importance && (
        <div>
          <SectionLabel className="mb-1">Por qué importa</SectionLabel>
          <p className="text-sm text-kore-gray-dark/80 leading-relaxed">{importance}</p>
        </div>
      )}
      {nextStep && (
        <div>
          <SectionLabel className="mb-1">Próximo paso</SectionLabel>
          <p className="text-sm text-kore-gray-dark/80 leading-relaxed">{nextStep}</p>
        </div>
      )}
    </div>
  );
}
