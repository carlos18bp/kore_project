'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `false` on the server render and the client's first (hydration)
 * render, then `true` after mount.
 *
 * Use it to gate any render that depends on client-only state — cookies,
 * sessionStorage, the auth store — so the first client render matches the
 * server HTML and React doesn't report a hydration mismatch. The auth store
 * reads cookies synchronously at module init, so `isAuthenticated`/`hydrated`
 * differ between server and client on that first render.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
