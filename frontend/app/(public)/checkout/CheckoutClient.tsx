'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';
import { useCheckoutStore, type PSEPaymentData } from '@/lib/stores/checkoutStore';
import PaymentMethodSelector, { type PaymentMethod } from '@/app/components/checkout/PaymentMethodSelector';
import CardPaymentForm, { type CardData } from '@/app/components/checkout/CardPaymentForm';
import NequiPaymentForm from '@/app/components/checkout/NequiPaymentForm';
import PSEPaymentForm from '@/app/components/checkout/PSEPaymentForm';
import BancolombiaPaymentForm from '@/app/components/checkout/BancolombiaPaymentForm';

const CHECKOUT_REGISTRATION_TOKEN_KEY = 'kore_checkout_registration_token';
const CHECKOUT_REGISTRATION_PACKAGE_KEY = 'kore_checkout_registration_package';

declare global {
  interface Window {
    WidgetCheckout?: new (config: Record<string, unknown>) => {
      open: (cb: (result: {
        payment_source?: { token?: string; type?: string };
        transaction?: { id?: string };
      }) => void) => void;
    };
  }
}

export default function CheckoutClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');

  const { isAuthenticated, hydrate, hydrated } = useAuthStore();
  const {
    package_: pkg,
    wompiConfig,
    loading,
    paymentStatus,
    intentResult,
    error,
    fetchPackage,
    fetchWompiConfig,
    prepareCheckout,
    tokenizeCard,
    purchaseSubscription,
    fetchPSEBanks,
    purchaseWithNequi,
    purchaseWithPSE,
    purchaseWithBancolombia,
    pollIntentStatus,
    reset,
  } = useCheckoutStore();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const prevPaymentStatusRef = useRef<string | null>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [widgetError, setWidgetError] = useState(false);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [registrationToken, setRegistrationToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = sessionStorage.getItem(CHECKOUT_REGISTRATION_TOKEN_KEY);
    const tokenPkg = sessionStorage.getItem(CHECKOUT_REGISTRATION_PACKAGE_KEY);
    return (token && packageId && tokenPkg === packageId) ? token : null;
  });

  useHeroAnimation(sectionRef);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (isAuthenticated) {
      setRegistrationToken(null);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const token = sessionStorage.getItem(CHECKOUT_REGISTRATION_TOKEN_KEY);
    const tokenPackage = sessionStorage.getItem(CHECKOUT_REGISTRATION_PACKAGE_KEY);
    if (token && packageId && tokenPackage === packageId) {
      setRegistrationToken(token);
      return;
    }

    const redirect = packageId ? `/register?package=${packageId}` : '/register';
    router.push(redirect);
  }, [hydrated, isAuthenticated, router, packageId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const prev = prevPaymentStatusRef.current;
    prevPaymentStatusRef.current = paymentStatus;

    if (prev !== null && prev !== paymentStatus && (paymentStatus === 'success' || paymentStatus === 'error')) {
      sessionStorage.removeItem(CHECKOUT_REGISTRATION_TOKEN_KEY);
      sessionStorage.removeItem(CHECKOUT_REGISTRATION_PACKAGE_KEY);
    }
  }, [paymentStatus]);

  const hasCheckoutAccess = isAuthenticated || Boolean(registrationToken);

  useEffect(() => {
    if (packageId && hasCheckoutAccess) {
      reset();
      fetchPackage(packageId);
      fetchWompiConfig();
    }
  }, [packageId, hasCheckoutAccess, fetchPackage, fetchWompiConfig, reset]);

  // Load Wompi widget script (programmatic mode — no data-public-key needed)
  useEffect(() => {
    if (!wompiConfig?.public_key) return;

    // Widget already available from a previous load
    if (window.WidgetCheckout) {
      setWidgetLoaded(true);
      return;
    }

    const existingScript = document.getElementById('wompi-widget-script');
    if (existingScript) {
      // Script tag exists but WidgetCheckout not yet available — poll for it
      const interval = setInterval(() => {
        if (window.WidgetCheckout) {
          clearInterval(interval);
          setWidgetLoaded(true);
          setWidgetError(false);
        }
      }, 200);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!window.WidgetCheckout) setWidgetError(true);
      }, 15000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    const script = document.createElement('script');
    script.id = 'wompi-widget-script';
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;

    const timeout = setTimeout(() => {
      setWidgetError(true);
    }, 15000);

    script.onload = () => {
      clearTimeout(timeout);
      setWidgetLoaded(true);
      setWidgetError(false);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      setWidgetError(true);
    };

    document.body.appendChild(script);

    return () => {
      clearTimeout(timeout);
    };
  }, [wompiConfig?.public_key]);

  // Clean up widget on unmount to prevent stale state across navigations / HMR
  useEffect(() => {
    return () => {
      const script = document.getElementById('wompi-widget-script');
      if (script) script.remove();
    };
  }, []);

  const handleCardPayment = useCallback(async (cardData: CardData) => {
    if (!pkg) return;

    useCheckoutStore.setState({ paymentStatus: 'processing', error: '' });

    console.log('[Checkout] Starting card tokenization...');
    const token = await tokenizeCard(cardData);
    if (!token) {
      console.error('[Checkout] Tokenization failed');
      useCheckoutStore.setState({ paymentStatus: 'error' });
      return;
    }
    console.log('[Checkout] Token obtained:', token.substring(0, 15) + '...');

    console.log('[Checkout] Calling purchaseSubscription...');
    await purchaseSubscription(
      pkg.id,
      token,
      isAuthenticated ? undefined : (registrationToken || undefined),
    );
  }, [pkg, tokenizeCard, purchaseSubscription, isAuthenticated, registrationToken]);

  const handleWidgetCheckout = useCallback(async () => {
    if (!wompiConfig || !pkg || !window.WidgetCheckout) return;
    setOpeningCheckout(true);

    const preparation = await prepareCheckout(
      pkg.id,
      isAuthenticated ? undefined : (registrationToken || undefined),
    );
    if (!preparation) {
      setOpeningCheckout(false);
      return;
    }

    let widgetCallbackFired = false;
    const widgetTimeout = setTimeout(() => {
      if (!widgetCallbackFired) {
        useCheckoutStore.setState({
          paymentStatus: 'error',
          error: 'La pasarela de pago no respondió. Recarga la página e intenta de nuevo.',
        });
        setOpeningCheckout(false);
      }
    }, 60000);

    const checkout = new window.WidgetCheckout({
      publicKey: wompiConfig.public_key,
      currency: preparation.currency,
      amountInCents: preparation.amount_in_cents,
      reference: preparation.reference,
      signature: { integrity: preparation.signature },
    });

    checkout.open(async (result) => {
      widgetCallbackFired = true;
      clearTimeout(widgetTimeout);
      const transactionId = result?.transaction?.id;
      if (transactionId) {
        useCheckoutStore.setState({ paymentStatus: 'polling', error: '' });
        await pollIntentStatus(preparation.reference, preparation.checkout_access_token, transactionId);
      } else {
        useCheckoutStore.setState({
          paymentStatus: 'error',
          error: 'No se pudo completar el pago. Intenta de nuevo.',
        });
      }
      setOpeningCheckout(false);
    });
  }, [
    wompiConfig,
    pkg,
    prepareCheckout,
    pollIntentStatus,
    isAuthenticated,
    registrationToken,
  ]);

  const handleNequiPayment = useCallback(async (phoneNumber: string) => {
    if (!pkg) return;
    await purchaseWithNequi(
      pkg.id,
      phoneNumber,
      isAuthenticated ? undefined : (registrationToken || undefined),
    );
  }, [pkg, purchaseWithNequi, isAuthenticated, registrationToken]);

  const handlePSEPayment = useCallback(async (pseData: PSEPaymentData) => {
    if (!pkg) return;
    await purchaseWithPSE(
      pkg.id,
      pseData,
      isAuthenticated ? undefined : (registrationToken || undefined),
    );
  }, [pkg, purchaseWithPSE, isAuthenticated, registrationToken]);

  const handleBancolombiaPayment = useCallback(async () => {
    if (!pkg) return;
    await purchaseWithBancolombia(
      pkg.id,
      isAuthenticated ? undefined : (registrationToken || undefined),
    );
  }, [pkg, purchaseWithBancolombia, isAuthenticated, registrationToken]);

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'polling' || openingCheckout;

  // Suppress unused variable warnings for widget functionality kept for fallback
  void widgetLoaded;
  void widgetError;
  void handleWidgetCheckout;

  if (!hydrated) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  if (!hasCheckoutAccess) return null;

  if (paymentStatus === 'success' && intentResult) {
    return (
      <section ref={sectionRef} className="min-h-screen bg-kore-cream flex items-center justify-center relative overflow-hidden">
        <div className="absolute -right-40 -bottom-40 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-[0.04] pointer-events-none select-none">
          <Image
            src="/images/flower.webp"
            alt=""
            fill
            sizes="(max-width: 1024px) 600px, 800px"
            className="object-contain"
            aria-hidden="true"
          />
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
                  <span className="font-medium text-kore-gray-dark">{intentResult.package_title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/60">Sesiones</span>
                  <span className="font-medium text-kore-gray-dark">{pkg.sessions_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/60">Monto</span>
                  <span className="font-medium text-kore-gray-dark">{formatPrice(intentResult.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/60">Vigencia</span>
                  <span className="font-medium text-kore-gray-dark">{pkg.validity_days} días</span>
                </div>
              </>
            )}
            <div className="pt-4">
              <Link
                href="/dashboard"
                className="w-full inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide cursor-pointer"
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
        <Image
          src="/images/flower.webp"
          alt=""
          fill
          sizes="(max-width: 1024px) 600px, 800px"
          className="object-contain"
          aria-hidden="true"
        />
      </div>

      <div className="w-full max-w-lg mx-auto px-6 py-16">
        {/* Header */}
        <div data-hero="badge" className="text-center mb-10">
          <Link href="/" className="cursor-pointer">
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
              <Link
                href="/programs"
                className="text-kore-red text-sm mt-2 inline-block hover:text-kore-red-dark transition-colors cursor-pointer"
              >
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
                    El cobro automático aplica solo con tarjeta. Con otros métodos, deberás renovar manualmente cada {pkg.validity_days} días.
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-kore-red">{error}</p>
                </div>
              )}

              {/* Payment Method Selection */}
              <div className="border-t border-kore-gray-light/40 pt-6">
                <PaymentMethodSelector
                  selectedMethod={selectedMethod}
                  onSelectMethod={setSelectedMethod}
                  disabled={isProcessing}
                />
              </div>

              {/* Payment Form */}
              {selectedMethod && (
                <div className="border-t border-kore-gray-light/40 pt-6">
                  {selectedMethod === 'card' && (
                    <CardPaymentForm
                      onSubmit={handleCardPayment}
                      isProcessing={isProcessing}
                      amount={formatPrice(pkg.price)}
                      disabled={isProcessing}
                    />
                  )}

                  {selectedMethod === 'nequi' && (
                    <NequiPaymentForm
                      onSubmit={handleNequiPayment}
                      isProcessing={isProcessing}
                      amount={formatPrice(pkg.price)}
                      disabled={isProcessing}
                    />
                  )}

                  {selectedMethod === 'pse' && (
                    <PSEPaymentForm
                      onSubmit={handlePSEPayment}
                      onFetchBanks={fetchPSEBanks}
                      isProcessing={isProcessing}
                      amount={formatPrice(pkg.price)}
                      disabled={isProcessing}
                    />
                  )}

                  {selectedMethod === 'bancolombia' && (
                    <BancolombiaPaymentForm
                      onSubmit={handleBancolombiaPayment}
                      isProcessing={isProcessing}
                      amount={formatPrice(pkg.price)}
                      packageTitle={pkg.title}
                      disabled={isProcessing}
                    />
                  )}
                </div>
              )}

              {/* Footer */}
              <p className="text-center text-xs text-kore-gray-dark/30 pt-4">
                Pago seguro procesado por Wompi
              </p>
            </div>
          )}
        </div>

        {/* Back link */}
        <p data-hero="cta" className="text-center text-xs text-kore-gray-dark/30 mt-8">
          <Link
            href="/programs"
            className="text-kore-red hover:text-kore-red-dark transition-colors cursor-pointer"
          >
            ← Volver a programas
          </Link>
        </p>
      </div>
    </section>
  );
}
