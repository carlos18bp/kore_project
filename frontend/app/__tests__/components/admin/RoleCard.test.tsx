import { render, screen, fireEvent } from '@testing-library/react';
import RoleCard from '@/app/components/admin/RoleCard';

type CardProps = React.ComponentProps<typeof RoleCard>;

function makeProps(overrides: Partial<CardProps> = {}): CardProps {
  return {
    selected: false,
    onSelect: jest.fn(),
    title: 'Cliente',
    description: 'Accede al app móvil.',
    icon: '♀',
    tone: 'sakura',
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('RoleCard', () => {
  it('renders the role title', () => {
    render(<RoleCard {...makeProps({ title: 'Cliente' })} />);
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('renders the role description', () => {
    render(<RoleCard {...makeProps({ description: 'Accede al app móvil.' })} />);
    expect(screen.getByText('Accede al app móvil.')).toBeInTheDocument();
  });

  it('renders the role icon', () => {
    render(<RoleCard {...makeProps({ icon: '✦' })} />);
    expect(screen.getByText('✦')).toBeInTheDocument();
  });

  it('calls onSelect when the card is clicked', () => {
    const onSelect = jest.fn();
    render(<RoleCard {...makeProps({ onSelect })} />);
    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders as a button element', () => {
    render(<RoleCard {...makeProps({ title: 'Entrenador' })} />);
    expect(screen.getByRole('button', { name: /Entrenador/ })).toBeInTheDocument();
  });
});
