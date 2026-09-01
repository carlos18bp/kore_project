/**
 * mis-creditos — the "Sesiones adicionales" (session grants) block.
 *
 * Relocated from `e2e/app/session-grants.spec.ts`, which deep-linked to
 * /mis-creditos and asserted two strings were visible without ever touching the
 * UI, so the gate disqualified it via `no_user_interaction` and the
 * `customer-session-grants` flow reported junk-only.
 *
 * The block is a conditional render over the booking store
 * (`app/(app)/mis-creditos/page.tsx:131-144`), so it belongs here. These tests
 * also cover what the spec never reached: the singular/plural branch and the
 * section being absent when the customer has no grants.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

type Grant = {
  id: number;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  expires_at: string;
};

const mockGrants: { value: Grant[] } = { value: [] };

const mockFetchWallet = jest.fn();
const mockFetchTransactions = jest.fn();
const mockFetchMyRedemptions = jest.fn();
const mockFetchSessionGrants = jest.fn();

jest.mock('@/lib/stores/walletStore', () => ({
  useWalletStore: () => ({
    wallet: {
      balance: 55,
      pending_balance: 0,
      current_streak: 1,
      longest_streak: 1,
      next_milestone: null,
    },
    walletLoaded: true,
    fetchWallet: mockFetchWallet,
    transactions: [],
    txLoading: false,
    fetchTransactions: mockFetchTransactions,
  }),
}));

jest.mock('@/lib/stores/storeStore', () => ({
  useStoreStore: () => ({ redemptions: [], fetchMyRedemptions: mockFetchMyRedemptions }),
}));

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: () => ({
    sessionGrants: mockGrants.value,
    fetchSessionGrants: mockFetchSessionGrants,
  }),
}));

jest.mock('@/app/components/shared/GlowRing', () => ({
  __esModule: true,
  default: () => null,
}));

import MisCreditosPage from '@/app/(app)/mis-creditos/page';

// The page lazy-loads more transactions through an IntersectionObserver, which
// jsdom does not implement.
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function grant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: 1,
    sessions_total: 3,
    sessions_used: 1,
    sessions_remaining: 2,
    // Midday UTC so the rendered day cannot slip across a timezone boundary.
    expires_at: '2026-08-05T12:00:00Z',
    ...overrides,
  };
}

describe('mis-creditos — session grants', () => {
  beforeAll(() => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      NoopIntersectionObserver;
  });

  beforeEach(() => {
    mockGrants.value = [];
    mockFetchSessionGrants.mockClear();
  });

  it('lists an active grant with its remaining sessions and expiry date', () => {
    // Catches: the grant row losing the count or the expiry, leaving the
    // customer unable to tell how many prepaid sessions are left or until when.
    mockGrants.value = [grant()];

    render(<MisCreditosPage />);

    const section = screen.getByText('Sesiones adicionales').parentElement!;
    expect(section).toHaveTextContent('2 sesiones');
    expect(section).toHaveTextContent('vencen el 5 de ago');
  });

  it('uses the singular "sesión" when exactly one session remains', () => {
    // Catches: the pluralisation branch being dropped, so the customer reads
    // "1 sesiones".
    mockGrants.value = [grant({ sessions_remaining: 1 })];

    render(<MisCreditosPage />);

    const section = screen.getByText('Sesiones adicionales').parentElement!;
    expect(section).toHaveTextContent('1 sesión');
    expect(section).not.toHaveTextContent('1 sesiones');
  });

  it('omits the whole section when the customer has no grants', () => {
    // Catches: rendering an empty "Sesiones adicionales" card to customers who
    // never bought extra sessions.
    render(<MisCreditosPage />);

    // Positive anchor first: without it an empty DOM or a failed render would
    // satisfy the absence check below and the test would prove nothing.
    expect(screen.getByTestId('mis-creditos')).toHaveTextContent('Mis créditos');
    expect(screen.queryByText('Sesiones adicionales')).toBeNull();
  });
});
