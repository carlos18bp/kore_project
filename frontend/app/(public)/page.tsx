import Hero from '@/app/components/Hero';
import Philosophy from '@/app/components/Philosophy';
import Programs from '@/app/components/Programs';
import PricingTable from '@/app/components/PricingTable';
import Process from '@/app/components/Process';
import Gallery from '@/app/components/Gallery';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Philosophy />
      <Programs />
      <PricingTable />
      <Process />
      <Gallery />
    </main>
  );
}
