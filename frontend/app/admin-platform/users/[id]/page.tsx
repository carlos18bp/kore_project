import UserDetailClient from './UserDetailClient';

export function generateStaticParams() {
  return [{ id: '0' }];
}

export default function Page() {
  return <UserDetailClient />;
}
