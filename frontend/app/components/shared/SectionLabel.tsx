import { ReactNode } from 'react';

type Tone = 'light' | 'dark';

type Props = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

export default function SectionLabel({ children, tone = 'light', className = '' }: Props) {
  const base =
    tone === 'dark'
      ? 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50'
      : 'text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40';
  return <p className={`${base} ${className}`}>{children}</p>;
}
