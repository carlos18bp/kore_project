import Navbar from '@/app/components/layouts/Navbar';
import ConditionalFooter from '@/app/components/layouts/ConditionalFooter';
import ConditionalWhatsApp from '@/app/components/layouts/ConditionalWhatsApp';

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
      <ConditionalWhatsApp />
    </div>
  );
}
