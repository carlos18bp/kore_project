'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';
import { useCheckoutStore } from '@/lib/stores/checkoutStore';

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutContent />
    </Suspense>
  );
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: Record<string, unknown>) => {
      open: (cb: (result: { transaction?: { id: string } }) => void) => void;
    };
  }
}

function CheckoutContent() {
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');

  const { isAuthenticated, hydrate, user } = useAuthStore();
  const {
    package_: pkg,
    wompiConfig,
    loading,
    paymentStatus,
    purchaseResult,
    error,
    fetchPackage,
    fetchWompiConfig,
    purchaseSubscription,
    reset,
  } = useCheckoutStore();

  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [tokenizing, setTokenizing] = useState(false);

  useHeroAnimation(sectionRef);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated) {
      const redirect = packageId ? `/register?package=${packageId}` : '/register';
      router.push(redirect);
    }
  }, [isAuthenticated, router, packageId]);

  useEffect(() => {
    if (packageId && isAuthenticated) {
      fetchPackage(packageId);
      fetchWompiConfig();
    }
  }, [packageId, isAuthenticated, fetchPackage, fetchWompiConfig]);

  // Load Wompi widget script
  useEffect(() => {
    if (!wompiConfig?.public_key) return;
    if (document.getElementById('wompi-widget-script')) {
      setWidgetLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'wompi-widget-script';
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => setWidgetLoaded(true);
    document.body.appendChild(script);
    return () => {
      // Don't remove on cleanup — Wompi widget should persist
    };
  }, [wompiConfig?.public_key]);

  const handleTokenize = useCallback(() => {
    if (!wompiConfig || !pkg || !window.WidgetCheckout) return;
    setTokenizing(true);

    const checkout = new window.WidgetCheckout({
      currency: pkg.currency,
      amountInCents: Math.round(parseFloat(pkg.price) * 100),
      reference: `kore-preview-${Date.now()}`,
      publicKey: wompiConfig.public_key,
      collectCustomerLegalId: false,
      'customer-data:email': user?.email || '',
      'customer-data:full-name': user?.name || '',
    });

    checkout.open(async (result) => {
      const txnId = result?.transaction?.id;
      if (txnId) {
        // For tokenization flow, the widget returns a transaction object.
        // We use the token approach: the card_token comes from the widget data attribute flow.
        // In custom button mode we call purchaseSubscription with the token.
        // However the Wompi widget in tokenize mode posts a form with the token.
        // For our SPA integration, we'll use a simplified approach:
        // The checkout widget processes the payment and we use the transaction ID.
        await purchaseSubscription(pkg.id, txnId);
      }
      setTokenizing(false);
    });
  }, [wompiConfig, pkg, user, purchaseSubscription]);

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  if (!isAuthenticated) return null;

  if (paymentStatus === 'success' && purchaseResult) {
    return (
      <section ref={sectionRef} className="min-h-screen bg-kore-cream flex items-center justify-center relative overflow-hidden">
        <div className="absolute -right-40 -bottom-40 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-[0.04] pointer-events-none select-none">
          <Image src="/images/flower.webp" alt="" fill className="object-contain" aria-hidden="true" />
        </div>
        <div className="w-full max-w-lg mx-auto px-6 py-16">
          <div data-hero="badge" className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="font-heading text-3xl font-semibold text-kore-gray-dark">
              ¡Pago exitoso!
            </h1>
            <p className="text-kore-gray-dark/50 text-sm mt-2">
              Tu suscripción ha sido activada
            </p>
          </div>
          <div data-hero="body" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-kore-gray-light/50 space-y-4">
            {pkg && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/60">Programa</span>
                  <span className="font-medium text-kore-gray-dark">{pkg.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/60">Sesiones</span>
                  <span className="font-medium text-kore-gray-dark">{purchaseResult.sessions_total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/60">Monto</span>
                  <span className="font-medium text-kore-gray-dark">{formatPrice(pkg.price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/60">Vigencia</span>
                  <span className="font-medium text-kore-gray-dark">{pkg.validity_days} días</span>
                </div>
                {purchaseResult.next_billing_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/60">Próximo cobro</span>
                    <span className="font-medium text-kore-gray-dark">{purchaseResult.next_billing_date}</span>
                  </div>
                )}
              </>
            )}
            <div className="pt-4">
              <Link
                href="/dashboard"
                className="w-full inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide"
              >
                Ir a mi dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream flex items-center justify-center relative overflow-hidden">
      <div className="absolute -right-40 -bottom-40 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-[0.04] pointer-events-none select-none">
        <Image src="/images/flower.webp" alt="" fill className="object-contain" aria-hidden="true" />
      </div>

      <div className="w-full max-w-lg mx-auto px-6 py-16">
        {/* Header */}
        <div data-hero="badge" className="text-center mb-10">
          <Link href="/">
            <span className="font-heading text-5xl font-semibold text-kore-gray-dark tracking-tight">
              KÓRE
            </span>
          </Link>
          <p data-hero="subtitle" className="text-kore-gray-dark/50 text-sm mt-2 tracking-wide">
            Completa tu suscripción
          </p>
        </div>

        {/* Content */}
        <div data-hero="body" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-kore-gray-light/50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-kore-red" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : !pkg ? (
            <div className="text-center py-12">
              <p className="text-kore-gray-dark/50 text-sm">
                {error || 'Paquete no encontrado'}
              </p>
              <Link href="/programas" className="text-kore-red text-sm mt-2 inline-block hover:text-kore-red-dark transition-colors">
                Ver programas disponibles
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Package summary */}
              <div>
                <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-4">
                  Resumen del programa
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/60">Programa</span>
                    <span className="font-medium text-kore-gray-dark">{pkg.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/60">Sesiones incluidas</span>
                    <span className="font-medium text-kore-gray-dark">{pkg.sessions_count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/60">Vigencia</span>
                    <span className="font-medium text-kore-gray-dark">{pkg.validity_days} días</span>
                  </div>
                  <div className="h-px bg-kore-gray-light/60 my-2" />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-kore-gray-dark">Total</span>
                    <span className="text-lg font-semibold text-kore-red">{formatPrice(pkg.price)}</span>
                  </div>
                  <p className="text-xs text-kore-gray-dark/40">
                    Se cobrará automáticamente cada {pkg.validity_days} días
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-kore-red">{error}</p>
                </div>
              )}

              {/* Payment button */}
              <div>
                <button
                  onClick={handleTokenize}
                  disabled={!widgetLoaded || paymentStatus === 'processing' || tokenizing}
                  className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paymentStatus === 'processing' || tokenizing ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Procesando pago...
                    </span>
                  ) : !widgetLoaded ? (
                    'Cargando pasarela de pago...'
                  ) : (
                    `Pagar ${formatPrice(pkg.price)}`
                  )}
                </button>
                <p className="text-center text-xs text-kore-gray-dark/30 mt-3">
                  Pago seguro procesado por Wompi
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Back link */}
        <p data-hero="cta" className="text-center text-xs text-kore-gray-dark/30 mt-8">
          <Link href="/programas" className="text-kore-red hover:text-kore-red-dark transition-colors">
            ← Volver a programas
          </Link>
        </p>
      </div>
    </section>
  );
}
