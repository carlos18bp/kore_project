'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function DiaProgramaPage() {
  const params = useParams();
  const router = useRouter();
  const dateParam = params.date as string;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (dateParam === today) {
      router.replace('/mi-programa/rutina');
    } else {
      router.replace('/mi-programa');
    }
  }, [dateParam, today, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
    </div>
  );
}
