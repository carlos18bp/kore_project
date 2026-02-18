'use client';

import { useEffect, useState } from 'react';
import FAQAccordion from '@/app/components/faq/FAQAccordion';
import { api } from '@/lib/services/http';

interface FAQCategory {
  id: number;
  name: string;
  slug: string;
  order: number;
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category?: number | null;
  category_name?: string | null;
}

interface FAQGroup {
  category: FAQCategory | null;
  items: FAQItem[];
}

export default function FAQPage() {
  const [groups, setGroups] = useState<FAQGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        const response = await api.get<FAQGroup[]>('/faqs/public/');
        setGroups(response.data);
      } catch (err) {
        console.error('Failed to fetch FAQs:', err);
        setError('No pudimos cargar las preguntas frecuentes. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchFAQs();
  }, []);

  return (
    <main className="min-h-screen bg-kore-cream">
      {/* Hero Section */}
      <section className="py-16 md:py-24">
        <div className="w-full px-6 md:px-10 lg:px-16">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-block text-kore-red text-sm font-medium tracking-widest uppercase mb-4">
              Preguntas Frecuentes
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl mb-6">
              ¿Tienes dudas? Aquí te ayudamos
            </h1>
            <p className="text-lg text-kore-gray-dark/70 leading-relaxed">
              Encuentra respuestas a las preguntas más comunes sobre nuestros programas,
              reservas, pagos y más.
            </p>
          </div>

          {/* FAQ Content */}
          <div className="max-w-3xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-kore-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-kore-gray-dark/60 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-kore-gray-dark/10 text-kore-gray-dark rounded-lg hover:bg-kore-gray-dark/20 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <FAQAccordion groups={groups} />
            )}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-12 bg-kore-wine-dark">
        <div className="w-full px-6 md:px-10 lg:px-16 text-center">
          <h2 className="text-2xl md:text-3xl text-white mb-4">
            ¿No encontraste lo que buscabas?
          </h2>
          <p className="text-white/70 mb-6">
            Contáctanos y resolveremos todas tus dudas personalmente.
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-3 bg-kore-red text-white rounded-lg font-medium hover:bg-kore-red-dark transition-colors"
          >
            Contactar
          </a>
        </div>
      </section>
    </main>
  );
}
