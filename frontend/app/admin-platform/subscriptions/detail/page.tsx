import { Suspense } from 'react';
import SubscriptionDetailPage from './SubscriptionDetailPage';

export default function Page() {
  return (
    <Suspense>
      <SubscriptionDetailPage />
    </Suspense>
  );
}
