import Hero from './components/Hero';
import Philosophy from './components/Philosophy';
import Programs from './components/Programs';
import PricingTable from './components/PricingTable';
import Process from './components/Process';
import Gallery from './components/Gallery';

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
