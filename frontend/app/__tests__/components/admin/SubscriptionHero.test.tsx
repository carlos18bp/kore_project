import { render, screen } from '@testing-library/react';
import SubscriptionHero from '@/app/components/admin/SubscriptionHero';

type HeroProps = React.ComponentProps<typeof SubscriptionHero>;

function makeProps(overrides: Partial<HeroProps> = {}): HeroProps {
  return {
    id: 12,
    categoryLabel: 'Personalizada',
    packageTitle: 'Plan Gold',
    status: 'active',
    startsAt: '01 ene 2026',
    expiresAt: '01 jun 2026',
    sessionsUsed: 4,
    sessionsTotal: 12,
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('SubscriptionHero', () => {
  it('renders the package title', () => {
    render(<SubscriptionHero {...makeProps()} />);
    expect(screen.getByText('Plan Gold')).toBeInTheDocument();
  });

  it('renders the subscription id with its category label', () => {
    render(<SubscriptionHero {...makeProps({ id: 12, categoryLabel: 'Personalizada' })} />);
    expect(screen.getByText('Suscripción #12 · Personalizada')).toBeInTheDocument();
  });

  it('renders the "Activa" status pill when the subscription is active', () => {
    render(<SubscriptionHero {...makeProps({ status: 'active' })} />);
    expect(screen.getByText('● Activa')).toBeInTheDocument();
  });

  it('renders the "Expirada" status pill when the subscription is expired', () => {
    render(<SubscriptionHero {...makeProps({ status: 'expired' })} />);
    expect(screen.getByText('● Expirada')).toBeInTheDocument();
  });

  it('renders "Vence" with the expiry date when the subscription is active', () => {
    render(<SubscriptionHero {...makeProps({ status: 'active', expiresAt: '01 jun 2026' })} />);
    expect(screen.getByText('Vence 01 jun 2026')).toBeInTheDocument();
  });

  it('renders "Venció" with the expiry date when the subscription is not active', () => {
    render(<SubscriptionHero {...makeProps({ status: 'expired', expiresAt: '01 jun 2026' })} />);
    expect(screen.getByText('Venció 01 jun 2026')).toBeInTheDocument();
  });

  it('renders the used sessions count in the progress ring', () => {
    render(<SubscriptionHero {...makeProps({ sessionsUsed: 4, sessionsTotal: 12 })} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders the total sessions count in the progress ring', () => {
    render(<SubscriptionHero {...makeProps({ sessionsUsed: 4, sessionsTotal: 12 })} />);
    expect(screen.getByText('/12')).toBeInTheDocument();
  });
});
