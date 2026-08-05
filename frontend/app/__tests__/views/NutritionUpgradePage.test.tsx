/**
 * my-nutrition — the paywalled (locked) state.
 *
 * Relocated from `e2e/app/nutrition-upgrade.spec.ts`, which deep-linked to
 * /my-nutrition and asserted two elements were visible without ever touching the
 * UI, so the gate disqualified it via `no_user_interaction` and the
 * `customer-buy-nutrition` flow reported junk-only.
 *
 * The locked state is a pure early-return branch of the page component
 * (`app/(app)/my-nutrition/page.tsx:835-848`), so it belongs here. These tests
 * also cover what the spec never asserted: the prorated price actually rendered
 * to the customer, and that the CTA starts the upgrade.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const CHECKOUT_URL = 'https://checkout.wompi.co/l/upgrade-123';

// Todas las funciones mock viven en el scope del módulo: si se crearan dentro
// de la factory, cada render devolvería identidades nuevas y los useEffect que
// las llevan como dependencia se re-dispararían en bucle.
const startNutritionUpgrade = jest.fn().mockResolvedValue(null);
const fetchNutritionAccess = jest.fn().mockResolvedValue(undefined);
const fetchUpgradeStatus = jest.fn().mockResolvedValue(null);
const fetchMyEntries = jest.fn();
const fetchMyWeeklyPlans = jest.fn();
const fetchTodayLog = jest.fn();
const updateMealEntry = jest.fn();
const uploadMealPhoto = jest.fn();
const logWaterGlass = jest.fn();

jest.mock('@/lib/stores/nutritionUpgradeStore', () => ({
  useNutritionUpgradeStore: () => ({
    access: false,
    price: 30000,
    fetchNutritionAccess,
    startNutritionUpgrade,
    fetchUpgradeStatus,
  }),
}));

jest.mock('@/lib/stores/nutritionStore', () => ({
  useNutritionStore: () => ({
    entries: [],
    weeklyPlans: [],
    fetchMyEntries,
    fetchMyWeeklyPlans,
  }),
}));

jest.mock('@/lib/stores/nutritionDailyStore', () => ({
  useNutritionDailyStore: () => ({
    todayLog: null,
    loading: false,
    fetchTodayLog,
    updateMealEntry,
    uploadMealPhoto,
    logWaterGlass,
  }),
}));

jest.mock('@/lib/utils/isMobileDevice', () => ({
  useIsMobileDevice: () => false,
}));

jest.mock('@/lib/utils/compressImage', () => ({
  compressImage: jest.fn(),
}));

jest.mock('@/app/components/nutrition-daily/CameraCapture', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/components/shared/PhotoViewer', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// framer-motion, swiper y css ya están mapeados a mocks globales en
// jest.config.js (moduleNameMapper) — no los re-mockeamos acá: un mock inline
// que devuelve un componente nuevo por acceso hace que React remonte en bucle.

import MyNutritionPage from '@/app/(app)/my-nutrition/page';

describe('my-nutrition — locked state', () => {
  beforeEach(() => {
    startNutritionUpgrade.mockReset().mockResolvedValue(null);
    fetchNutritionAccess.mockClear();
  });

  it('renders the paywall with its CTA once the access check says there is no access', async () => {
    // Catches: the locked branch disappearing, which would drop a customer
    // without nutrition into the full plan UI they have not paid for.
    render(<MyNutritionPage />);

    expect(await screen.findByTestId('nutrition-locked')).toBeInTheDocument();
    expect(screen.getByTestId('nutrition-upgrade-cta')).toHaveTextContent('Agrega nutrición a tu plan');
    expect(screen.getByText('La nutrición no está incluida en tu plan.')).toBeInTheDocument();
  });

  it('shows the prorated price formatted for es-CO', async () => {
    // Catches: dropping the price from the paywall, or formatting 30000 as
    // "30000"/"30,000" instead of the Colombian "30.000" the customer expects.
    render(<MyNutritionPage />);

    await screen.findByTestId('nutrition-locked');

    expect(
      screen.getByText(/Desde \$30\.000\/mes \(prorrateado este mes\)\./),
    ).toBeInTheDocument();
  });

  // quality: allow-mock-only (el efecto final de este click es
  // `window.location.href = url` — una navegación real. jsdom no deja redefinir
  // `window.location` ni su accessor `href` (ambos lanzan "Cannot redefine
  // property"), así que el spy es la única evidencia observable de que el
  // checkout arrancó. La aserción de estado que sí se puede hacer — que el
  // paywall sigue en pantalla y no se desarma antes de navegar — va incluida.)
  it('starts the checkout when the customer clicks the CTA', async () => {
    // Catches: an inert paywall button — the flow's whole point is that this
    // click begins the purchase.
    startNutritionUpgrade.mockResolvedValueOnce(CHECKOUT_URL);
    const user = userEvent.setup();
    render(<MyNutritionPage />);

    await user.click(await screen.findByTestId('nutrition-upgrade-cta'));

    await waitFor(() => expect(startNutritionUpgrade).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('nutrition-locked')).toBeInTheDocument();
  });
});
