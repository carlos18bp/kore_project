import Hero from '@/app/components/Hero';
import Philosophy from '@/app/components/Philosophy';
import ForWhom from '@/app/components/ForWhom';
import Problems from '@/app/components/Problems';
import PricingTable from '@/app/components/PricingTable';
import Process from '@/app/components/Process';
import Gallery from '@/app/components/Gallery';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Philosophy />
      <ForWhom />
      <Problems />
      <Process />
      <PricingTable />
      <Gallery />
    </main>
  );
}
