'use client';

import { Suspense } from 'react';
import AcceptInviteClient from './AcceptInviteClient';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteClient />
    </Suspense>
  );
}
