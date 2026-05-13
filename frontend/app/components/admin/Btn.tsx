'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'dark' | 'danger';
type Size = 'sm' | 'md';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-kore-red text-white border-transparent hover:bg-kore-red-dark shadow-[0_6px_16px_-6px_rgba(224,0,0,0.45)]',
  ghost:
    'bg-white/70 text-kore-burgundy border-kore-burgundy/10 hover:bg-white/90',
  dark:
    'bg-kore-wine-deep text-kore-ivory border-transparent hover:bg-kore-wine-mid shadow-[0_4px_12px_-4px_rgba(45,15,26,0.35)]',
  danger:
    'bg-transparent text-kore-red border-kore-red/30 hover:bg-kore-red/5',
};

const SIZES: Record<Size, string> = {
  sm: 'py-2 px-3.5 text-[11px]',
  md: 'py-3 px-5 text-[12px]',
};

const Btn = forwardRef<HTMLButtonElement, Props>(function Btn(
  { variant = 'primary', size = 'md', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold tracking-[0.02em] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
});

export default Btn;
