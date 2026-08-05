/**
 * comprar-creditos — package list and the return-from-checkout states.
 *
 * Relocated from `e2e/app/comprar-creditos.spec.ts`, which deep-linked to the
 * page and asserted visibility without ever touching the UI, so the gate
 * disqualified both tests via `no_user_interaction` and the
 * `customer-buy-credits` flow reported junk-only.
 *
 * The page is 82 lines of pure client state (`app/(app)/comprar-creditos/page.tsx`),
 * so it belongs here. These tests also cover what the spec never reached: the
 * declined branch, the "confirmando" interim state, the wallet refresh after an
 * approved payment, and the purchase actually being started for the clicked
 * package.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockState: {
  packages: Array<{ id: number; name: string; credits: number; price_cop: number }>;
  loading: boolean;
  error: string | null;
} = { packages: [], loading: false, error: null };

let mockRef: string | null = null;

const mockFetchCreditPackages = jest.fn();
const mockStartCreditPurchase = jest.fn().mockResolvedValue(null);
const mockFetchPurchaseStatus = jest.fn().mockResolvedValue(null);
const mockFetchWallet = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => (key === 'ref' ? mockRef : null) }),
}));

jest.mock('@/lib/stores/creditPurchaseStore', () => ({
  useCreditPurchaseStore: () => ({
    packages: mockState.packages,
    loading: mockState.loading,
    error: mockState.error,
    fetchCreditPackages: mockFetchCreditPackages,
    startCreditPurchase: mockStartCreditPurchase,
    fetchPurchaseStatus: mockFetchPurchaseStatus,
  }),
}));

jest.mock('@/lib/stores/walletStore', () => ({
  useWalletStore: () => ({ fetchWallet: mockFetchWallet }),
}));

import ComprarCreditosPage from '@/app/(app)/comprar-creditos/page';

const IMPULSO = { id: 7, name: 'Impulso', credits: 100, price_cop: 20000 };

describe('comprar-creditos', () => {
  beforeEach(() => {
    mockState.packages = [];
    mockState.loading = false;
    mockState.error = null;
    mockRef = null;
    mockFetchCreditPackages.mockClear();
    mockStartCreditPurchase.mockReset().mockResolvedValue(null);
    mockFetchPurchaseStatus.mockReset().mockResolvedValue(null);
    mockFetchWallet.mockClear();
  });

  it('renders each package with its credits, name and price formatted for es-CO', () => {
    // Catches: a package card losing its price, or formatting 20000 as
    // "20000"/"20,000" instead of the Colombian "20.000" the customer reads.
    mockState.packages = [IMPULSO];

    render(<ComprarCreditosPage />);

    const card = screen.getByTestId('credit-package');
    expect(card).toHaveTextContent('Impulso');
    expect(card).toHaveTextContent('100');
    expect(card).toHaveTextContent('$20.000');
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeEnabled();
  });

  it('shows the empty state when there are no packages', () => {
    // Catches: an empty catalogue rendering a blank page instead of telling the
    // customer there is nothing to buy.
    render(<ComprarCreditosPage />);

    expect(screen.getByTestId('comprar-creditos')).toHaveTextContent('No hay paquetes disponibles.');
  });

  it('surfaces a store error to the customer', () => {
    // Catches: swallowing the store error so a failed catalogue load looks like
    // an empty catalogue.
    mockState.error = 'No pudimos cargar los paquetes.';

    render(<ComprarCreditosPage />);

    expect(screen.getByTestId('comprar-creditos')).toHaveTextContent('No pudimos cargar los paquetes.');
  });

  describe('returning from the Wompi checkout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('shows the confirming notice while the purchase status is still pending', () => {
      // Catches: a silent page on return from checkout — the customer has paid
      // and must be told the confirmation is in flight.
      mockRef = 'CR-ok';
      mockFetchPurchaseStatus.mockResolvedValue({ status: 'pending' });

      render(<ComprarCreditosPage />);

      expect(screen.getByTestId('comprar-creditos')).toHaveTextContent('Confirmando tu pago…');
    });

    it('confirms an approved purchase and refreshes the wallet', async () => {
      // Catches: the approved banner never appearing, or the wallet not being
      // refetched so the customer sees the old balance after paying.
      mockRef = 'CR-ok';
      mockFetchPurchaseStatus.mockResolvedValue({ status: 'approved', credits: 100 });

      render(<ComprarCreditosPage />);
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockFetchPurchaseStatus).toHaveBeenCalledWith('CR-ok');
      expect(screen.getByTestId('comprar-creditos')).toHaveTextContent('¡Pago aprobado! Tus créditos ya están en tu saldo.');
      expect(mockFetchWallet).toHaveBeenCalledWith(true);
    });

    it('tells the customer when the purchase was declined and does not touch the wallet', async () => {
      // Catches: a declined payment rendering the approved banner, or crediting
      // a wallet refresh for money that never arrived.
      mockRef = 'CR-bad';
      mockFetchPurchaseStatus.mockResolvedValue({ status: 'declined' });

      render(<ComprarCreditosPage />);
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByTestId('comprar-creditos')).toHaveTextContent('El pago no se completó. Intenta de nuevo.');
      expect(screen.queryByText(/¡Pago aprobado!/)).not.toBeInTheDocument();
      expect(mockFetchWallet).not.toHaveBeenCalled();
    });
  });

  it('starts the purchase for the package the customer clicked', async () => {
    // Catches: the buy button starting the wrong package's purchase — the
    // customer would be charged for something they did not choose.
    mockState.packages = [IMPULSO];
    const user = userEvent.setup();

    render(<ComprarCreditosPage />);
    await user.click(screen.getByRole('button', { name: 'Comprar' }));

    expect(mockStartCreditPurchase).toHaveBeenCalledWith(IMPULSO.id);
  });

  it('re-enables the buy button when no checkout URL comes back', async () => {
    // Catches: a failed purchase leaving the button stuck on "Abriendo…", so
    // the customer can never retry.
    mockState.packages = [IMPULSO];
    mockStartCreditPurchase.mockResolvedValue(null);
    const user = userEvent.setup();

    render(<ComprarCreditosPage />);
    await user.click(screen.getByRole('button', { name: 'Comprar' }));

    expect(await screen.findByRole('button', { name: 'Comprar' })).toBeEnabled();
  });
});
