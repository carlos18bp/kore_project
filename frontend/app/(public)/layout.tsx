import Navbar from '@/app/components/layouts/Navbar';
import Footer from '@/app/components/layouts/Footer';

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
