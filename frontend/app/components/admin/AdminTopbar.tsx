'use client';

import Link from 'next/link';

export type Crumb = { label: string; href?: string };

type Props = {
  breadcrumb?: Crumb[];
  title: string;
};

export default function AdminTopbar({ breadcrumb, title }: Props) {
  return (
    <header className="sticky top-0 z-30 px-6 xl:px-10 py-5 bg-kore-cream/85 backdrop-blur-md border-b border-kore-burgundy/10 flex items-center justify-between gap-6">
      <div className="flex-1 min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.20em] text-kore-burgundy/55">
            {breadcrumb.map((b, i) => (
              <span key={`${b.label}-${i}`}>
                {i > 0 && <span className="mx-2 opacity-50">/</span>}
                {b.href ? (
                  <Link href={b.href} className="hover:text-kore-burgundy/80">
                    {b.label}
                  </Link>
                ) : (
                  b.label
                )}
              </span>
            ))}
          </div>
        )}
        <h1 className="font-heading text-2xl xl:text-[26px] font-semibold text-kore-burgundy mt-1.5 tracking-tight truncate">
          {title}
        </h1>
      </div>

      <div className="hidden md:flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-kore-sage/15 border border-kore-sage/35">
          <span className="w-1.5 h-1.5 rounded-full bg-kore-sage" />
          <span className="text-[11px] font-semibold text-kore-sage-deep tracking-wide">
            Sistema operativo
          </span>
        </div>
      </div>
    </header>
  );
}
