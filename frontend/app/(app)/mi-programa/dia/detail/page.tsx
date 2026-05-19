import { Suspense } from 'react';
import DiaDetailPage from './DiaDetailPage';

export default function Page() {
  return (
    <Suspense>
      <DiaDetailPage />
    </Suspense>
  );
}
