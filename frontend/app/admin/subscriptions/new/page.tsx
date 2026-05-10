import { Suspense } from 'react';
import NewSubscriptionClient from './NewSubscriptionClient';

export default function NewSubscriptionPage() {
  return (
    <Suspense fallback={null}>
      <NewSubscriptionClient />
    </Suspense>
  );
}
