'use client';

import { useEffect, useState } from 'react';
import { MapPin, Clock, Mail, Phone } from 'lucide-react';
import { api } from '@/lib/services/http';

interface SiteSettings {
  id: number;
  company_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  business_hours: string;
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ContactPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get<SiteSettings>('/site-settings/');
        setSettings(response.data);
      } catch (err) {
        console.error('Failed to fetch site settings:', err);
      }
    };

    fetchSettings();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('loading');
    setErrorMessage('');

    try {
      await api.post('/contact-messages/', formData);
      setFormStatus('success');
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      console.error('Failed to submit contact form:', err);
      setFormStatus('error');
      setErrorMessage('No pudimos enviar tu mensaje. Por favor, intenta de nuevo.');
    }
  };

  return (
    <main className="min-h-screen bg-kore-cream">
      {/* Hero Section */}
      <section className="pt-28 py-16 md:py-24">
        <div className="w-full px-6 md:px-10 lg:px-16">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-block text-kore-red text-sm font-medium tracking-widest uppercase mb-4">
              Contacto
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl mb-6">
              Estamos aquí para ayudarte
            </h1>
            <p className="text-lg text-kore-gray-dark/70 leading-relaxed">
              ¿Tienes preguntas sobre nuestros programas o quieres más información?
              Escríbenos y te responderemos lo antes posible.
            </p>
          </div>

          {/* Contact Grid */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl md:text-3xl mb-6">Información de contacto</h2>
                <div className="space-y-6">
                  {/* Location */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-kore-red/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-kore-red" />
                    </div>
                    <div>
                      <h3 className="font-medium text-kore-gray-dark mb-1">Ubicación</h3>
                      <p className="text-kore-gray-dark/70">
                        Bogotá, Colombia
                      </p>
                      {settings?.address && (
                        <p className="text-kore-gray-dark/70">{settings.address}</p>
                      )}
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-kore-red/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-kore-red" />
                    </div>
                    <div>
                      <h3 className="font-medium text-kore-gray-dark mb-1">Horario de atención</h3>
                      <p className="text-kore-gray-dark/70">
                        {settings?.business_hours || 'Lunes a Viernes: 6:00 AM - 8:00 PM'}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-kore-red/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-kore-red" />
                    </div>
                    <div>
                      <h3 className="font-medium text-kore-gray-dark mb-1">Email</h3>
                      <a
                        href="mailto:info@korehealths.com"
                        className="text-kore-red hover:text-kore-red-dark transition-colors"
                      >
                        info@korehealths.com
                      </a>
                    </div>
                  </div>

                  {/* Phone */}
                  {settings?.phone && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-kore-red/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone className="w-6 h-6 text-kore-red" />
                      </div>
                      <div>
                        <h3 className="font-medium text-kore-gray-dark mb-1">Teléfono</h3>
                        <a
                          href={`tel:${settings.phone}`}
                          className="text-kore-red hover:text-kore-red-dark transition-colors"
                        >
                          {settings.phone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
              <h2 className="text-2xl mb-6">Envíanos un mensaje</h2>

              {formStatus === 'success' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-kore-gray-dark mb-2">
                    ¡Mensaje enviado!
                  </h3>
                  <p className="text-kore-gray-dark/70 mb-6">
                    Gracias por contactarnos. Te responderemos pronto.
                  </p>
                  <button
                    onClick={() => setFormStatus('idle')}
                    className="text-kore-red hover:text-kore-red-dark font-medium"
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-kore-gray-dark mb-2">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-kore-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-kore-red/50 focus:border-kore-red transition-colors"
                      placeholder="Tu nombre completo"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-kore-gray-dark mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-kore-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-kore-red/50 focus:border-kore-red transition-colors"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-kore-gray-dark mb-2">
                      Teléfono (opcional)
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-kore-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-kore-red/50 focus:border-kore-red transition-colors"
                      placeholder="+57 300 000 0000"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-kore-gray-dark mb-2">
                      Mensaje *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      rows={4}
                      className="w-full px-4 py-3 border border-kore-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-kore-red/50 focus:border-kore-red transition-colors resize-none"
                      placeholder="¿En qué podemos ayudarte?"
                    />
                  </div>

                  {formStatus === 'error' && errorMessage && (
                    <p className="text-red-600 text-sm">{errorMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={formStatus === 'loading'}
                    className="w-full py-3 bg-kore-red text-white rounded-lg font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {formStatus === 'loading' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar mensaje'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
