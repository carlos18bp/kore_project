import Navbar from '@/app/components/layouts/Navbar';
import Footer from '@/app/components/layouts/Footer';

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
