import SubscriptionDetailPage from './SubscriptionDetailPage';

export function generateStaticParams() {
  return [{ id: '0' }];
}

export default function Page() {
  return <SubscriptionDetailPage />;
}
