'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HoyPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/mi-programa/rutina'); }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
    </div>
  );
}
