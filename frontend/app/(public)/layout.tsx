import Navbar from '@/app/components/layouts/Navbar';
import ConditionalFooter from '@/app/components/layouts/ConditionalFooter';

export const dynamic = 'force-dynamic';

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden">
      <Navbar />
      {children}
      <ConditionalFooter />
    </div>
  );
}
