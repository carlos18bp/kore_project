'use client';

import { useEffect, useState } from 'react';

/**
 * Synchronously detect whether the current device is a phone/tablet with a camera.
 *
 * Returns `false` during SSR (no `navigator`). On the client, combines a UA
 * regex with iPadOS detection (touch points on Macintosh) to catch iPads that
 * masquerade as desktop.
 *
 * Use this only for client-side gating (e.g. blocking gallery uploads). Do not
 * use it for security — it can be spoofed.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ reports as Macintosh; distinguish via multi-touch.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

/**
 * React hook wrapper around `isMobileDevice`. Returns `false` on the initial
 * render (SSR-safe), then re-evaluates after mount.
 */
export function useIsMobileDevice(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(isMobileDevice());
  }, []);
  return mobile;
}
