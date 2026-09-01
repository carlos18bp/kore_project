'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgramStore } from '@/lib/stores/programStore';
import { compressImage } from '@/lib/utils/compressImage';
import { createUploadQueue, scheduleCaptureOffsets } from '@/lib/utils/workoutCaptures';

export type CameraPermission = 'unknown' | 'granted' | 'denied' | 'unsupported';

const STORAGE_KEY = 'kore_workout_camera';

type Args = {
  active: boolean;          // rule on + consent granted + phase === 'execute'
  logId: number | null;
  exLogId: number | null;
  windowMs: number;         // expected execution window for the current set
};

let stampCounter = 0;
function queueStamp() {
  stampCounter += 1;
  return `${stampCounter}`;
}

export function useWorkoutCaptures({ active, logId, exLogId, windowMs }: Args) {
  const uploadExerciseCapture = useProgramStore((s) => s.uploadExerciseCapture);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [permission, setPermission] = useState<CameraPermission>(() => {
    if (typeof window === 'undefined') return 'unknown';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'unknown';
  });
  const [capturing, setCapturing] = useState(false);

  const queue = useMemo(
    () => createUploadQueue((item) => uploadExerciseCapture(item.logId, item.exLogId, item.file)),
    [uploadExerciseCapture],
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      localStorage.setItem(STORAGE_KEY, 'granted');
      setPermission('granted');
      return true;
    } catch {
      localStorage.setItem(STORAGE_KEY, 'denied');
      setPermission('denied');
      return false;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const decline = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'denied');
    setPermission('denied');
    releaseStream();
  }, [releaseStream]);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || logId === null || exLogId === null) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return;
    const raw = new File([blob], `capture-${exLogId}-${queueStamp()}.jpg`, { type: 'image/jpeg' });
    const compressed = await compressImage(raw).catch(() => raw);
    queue.enqueue({ logId, exLogId, file: compressed });
  }, [logId, exLogId, queue]);

  // Consent scope: the camera runs ONLY while an exercise set is executing.
  // Outside `active` the stream is released (camera light off); with browser
  // permission already granted, re-acquiring at the next set needs no prompt.
  useEffect(() => {
    if (active && permission === 'granted' && !streamRef.current) {
      void requestPermission();
    }
    if (!active) {
      releaseStream();
    }
  }, [active, permission, requestPermission, releaseStream]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      releaseStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule random captures while an exercise set is executing.
  useEffect(() => {
    if (!active || permission !== 'granted' || exLogId === null) return;
    const count = 2 + (Math.random() < 0.5 ? 1 : 0);
    const offsets = scheduleCaptureOffsets(count, windowMs);
    setCapturing(true);
    timeoutsRef.current = offsets.map((ms) => window.setTimeout(() => void captureFrame(), ms));
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      setCapturing(false);
      void queue.flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, permission, exLogId]);

  return { videoRef, permission, requestPermission, decline, releaseStream, capturing };
}
