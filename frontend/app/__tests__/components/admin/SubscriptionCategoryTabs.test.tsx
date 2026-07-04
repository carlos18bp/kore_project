import { render, screen, fireEvent } from '@testing-library/react';
import SubscriptionCategoryTabs from '@/app/components/admin/SubscriptionCategoryTabs';

type TabsProps = React.ComponentProps<typeof SubscriptionCategoryTabs>;

function makeProps(overrides: Partial<TabsProps> = {}): TabsProps {
  return {
    active: 'semi_personalizado',
    counts: { semi_personalizado: 2, personalizado: 5, terapeutico: 0 },
    onChange: jest.fn(),
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('SubscriptionCategoryTabs', () => {
  it('renders the "Pareja" tab', () => {
    render(<SubscriptionCategoryTabs {...makeProps()} />);
    expect(screen.getByText('Pareja')).toBeInTheDocument();
  });

  it('renders the "Personalizada" tab', () => {
    render(<SubscriptionCategoryTabs {...makeProps()} />);
    expect(screen.getByText('Personalizada')).toBeInTheDocument();
  });

  it('renders the "Terapéutica" tab', () => {
    render(<SubscriptionCategoryTabs {...makeProps()} />);
    expect(screen.getByText('Terapéutica')).toBeInTheDocument();
  });

  it('renders the pluralized count when a category has more than one subscription', () => {
    render(<SubscriptionCategoryTabs {...makeProps({ counts: { semi_personalizado: 2, personalizado: 5, terapeutico: 0 } })} />);
    expect(screen.getByText('2 suscripciones')).toBeInTheDocument();
  });

  it('renders the singular count when a category has exactly one subscription', () => {
    render(<SubscriptionCategoryTabs {...makeProps({ counts: { semi_personalizado: 1, personalizado: 5, terapeutico: 0 } })} />);
    expect(screen.getByText('1 suscripcion')).toBeInTheDocument();
  });

  it('calls onChange with the category key when a tab is clicked', () => {
    const onChange = jest.fn();
    render(<SubscriptionCategoryTabs {...makeProps({ onChange })} />);
    fireEvent.click(screen.getByText('Terapéutica'));
    expect(onChange).toHaveBeenCalledWith('terapeutico');
  });
});
