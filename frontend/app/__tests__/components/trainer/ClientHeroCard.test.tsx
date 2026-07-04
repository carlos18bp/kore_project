import { render, screen } from '@testing-library/react';
import ClientHeroCard from '@/app/components/trainer/ClientHeroCard';
import type { ClientRiskScore } from '@/lib/stores/trainerStore';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img data-testid="client-avatar" {...props} />,
}));

type ClientProp = React.ComponentProps<typeof ClientHeroCard>['client'];

function makeClient(over: Partial<ClientProp> = {}): ClientProp {
  return {
    first_name: 'Ana',
    last_name: 'Ruiz',
    avatar_url: null,
    profile: { primary_goal: 'fat_loss' },
    next_session: null,
    ...over,
  };
}

function makeAlert(over: Partial<ClientRiskScore> = {}): ClientRiskScore {
  return {
    id: 1,
    customer_id: 10,
    customer_name: 'Ana Ruiz',
    avatar_url: null,
    level: 'medio',
    computed_at: '2026-04-01T00:00:00Z',
    kore_score: 70,
    signals_count: 1,
    behavioral_signals: [],
    clinical_signals: [],
    resolutions: [],
    ...over,
  };
}

describe('ClientHeroCard', () => {
  it('renders the client full name', () => {
    render(<ClientHeroCard client={makeClient()} alerts={[]} />);
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('maps a known primary goal to its Spanish label', () => {
    render(<ClientHeroCard client={makeClient({ profile: { primary_goal: 'muscle_gain' } })} alerts={[]} />);
    expect(screen.getByText('Ganar masa muscular')).toBeInTheDocument();
  });

  it('shows the raw goal value when the goal is not mapped', () => {
    render(<ClientHeroCard client={makeClient({ profile: { primary_goal: 'custom_goal' } })} alerts={[]} />);
    expect(screen.getByText('custom_goal')).toBeInTheDocument();
  });

  it('renders the avatar initial when there is no avatar url', () => {
    render(<ClientHeroCard client={makeClient({ avatar_url: null })} alerts={[]} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders the avatar image when an avatar url is present', () => {
    render(<ClientHeroCard client={makeClient({ avatar_url: 'https://cdn/x.png' })} alerts={[]} />);
    expect(screen.getByTestId('client-avatar')).toHaveAttribute('src', 'https://cdn/x.png');
  });

  it('shows the high-risk badge when an alto alert exists', () => {
    render(<ClientHeroCard client={makeClient()} alerts={[makeAlert({ level: 'alto' })]} />);
    expect(screen.getByText('Alto riesgo')).toBeInTheDocument();
  });

  it('prefers the alto alert over a medio alert for the badge', () => {
    render(
      <ClientHeroCard
        client={makeClient()}
        alerts={[makeAlert({ id: 1, level: 'medio' }), makeAlert({ id: 2, level: 'alto' })]}
      />,
    );
    expect(screen.getByText('Alto riesgo')).toBeInTheDocument();
    expect(screen.queryByText('Riesgo medio')).not.toBeInTheDocument();
  });

  it('renders no risk badge when there are no alto or medio alerts', () => {
    render(<ClientHeroCard client={makeClient()} alerts={[makeAlert({ level: 'bajo' })]} />);
    expect(screen.queryByText('Riesgo bajo')).not.toBeInTheDocument();
  });

  it('shows the next-session block when a next session exists', () => {
    render(<ClientHeroCard client={makeClient({ next_session: { starts_at: '2026-05-20T09:00:00' } })} alerts={[]} />);
    expect(screen.getByText('Próxima sesión')).toBeInTheDocument();
  });

  it('omits the next-session block when there is no next session', () => {
    render(<ClientHeroCard client={makeClient({ next_session: null })} alerts={[]} />);
    expect(screen.queryByText('Próxima sesión')).not.toBeInTheDocument();
  });
});
