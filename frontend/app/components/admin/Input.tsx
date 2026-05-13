'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ReactNode;
};

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { icon, className = '', ...rest },
  ref,
) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kore-burgundy/55 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        {...rest}
        className={`w-full ${icon ? 'pl-10 pr-3.5' : 'px-3.5'} py-2.5 rounded-xl bg-white/85 border border-kore-burgundy/10 text-[13px] text-kore-gray-dark outline-none transition-all duration-150 focus:border-kore-red focus:ring-2 focus:ring-kore-red/15 placeholder:text-kore-burgundy/40 ${className}`}
      />
    </div>
  );
});

export default Input;
