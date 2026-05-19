import { Suspense } from 'react';
import UserDetailClient from './UserDetailClient';

export default function Page() {
  return (
    <Suspense>
      <UserDetailClient />
    </Suspense>
  );
}
