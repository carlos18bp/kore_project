'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HoyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const start = searchParams.get('start');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const query = start === '1' ? '?start=1' : '';
    router.replace(`/mi-programa/dia/${today}${query}`);
  }, [router, start]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
    </div>
  );
}

export default function HoyRedirectPage() {
  return (
    <Suspense>
      <HoyRedirect />
    </Suspense>
  );
}
