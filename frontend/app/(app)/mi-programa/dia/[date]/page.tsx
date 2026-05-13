import DiaDetailPage from './DiaDetailPage';

export function generateStaticParams() {
  return [{ date: '2026-01-01' }];
}

export default function Page() {
  return <DiaDetailPage />;
}
