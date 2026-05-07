'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

type CTA = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: CTA;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_PADDING: Record<NonNullable<Props['size']>, string> = {
  sm: 'py-6',
  md: 'py-10',
  lg: 'py-16',
};

const DEFAULT_ICON = (
  <svg
    className="w-6 h-6 text-kore-gray-dark/30"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
    />
  </svg>
);

export default function EmptyState({
  icon,
  title,
  description,
  cta,
  size = 'md',
  className = '',
}: Props) {
  return (
    <div className={`text-center ${SIZE_PADDING[size]} ${className}`}>
      <div className="w-12 h-12 rounded-full bg-white border border-kore-gray-light/40 mx-auto mb-3 flex items-center justify-center">
        {icon ?? DEFAULT_ICON}
      </div>
      <p className="text-sm font-medium text-kore-gray-dark/60">{title}</p>
      {description && (
        <p className="text-xs text-kore-gray-dark/40 mt-1 max-w-xs mx-auto leading-relaxed">{description}</p>
      )}
      {cta && (
        <div className="mt-4">
          {cta.href ? (
            <Link
              href={cta.href}
              prefetch={false}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-kore-red text-white text-xs font-semibold active:scale-95 transition-transform duration-100 hover:bg-kore-red-dark"
            >
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-kore-red text-white text-xs font-semibold active:scale-95 transition-transform duration-100 hover:bg-kore-red-dark"
            >
              {cta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
