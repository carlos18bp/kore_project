'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarioPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/book-session');
  }, [router]);

  return (
    <section className="min-h-screen bg-kore-cream flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
    </section>
  );
}
