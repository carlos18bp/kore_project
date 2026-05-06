'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MiNutricionDiariaRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/my-nutrition'); }, [router]);
  return null;
}
