import { render, screen } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: null }), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(), extractApiError: jest.fn(),
}));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import { useWalletStore } from '@/lib/stores/walletStore';
import CreditBalanceBadge from '@/app/components/dashboard/CreditBalanceBadge';

describe('CreditBalanceBadge', () => {
  it('renders the balance and links to /mis-creditos', () => {
    useWalletStore.setState({
      wallet: { balance: 55, pending_balance: 0, current_streak: 0, longest_streak: 0, last_active_date: null, next_milestone: null },
      walletLoaded: true, fetchWallet: async () => {},
    } as never);
    render(<CreditBalanceBadge />);
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('créditos')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/mis-creditos');
  });

  it('shows a dash before the wallet loads', () => {
    useWalletStore.setState({ wallet: null, walletLoaded: false, fetchWallet: async () => {} } as never);
    render(<CreditBalanceBadge />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
